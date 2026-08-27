import { after } from 'next/server'
import { eq, sql } from 'drizzle-orm'

import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { conversations } from '@/lib/db/schema'
import {
  appendTurn,
  buildPromptFor,
  conversationHistory,
  getOwnedConversation,
  nextSeq,
  saveCorrections,
} from '@/lib/domain/conversation'
import { recordMistakes } from '@/lib/domain/mistakes'
import { getUserAi, toAiError } from '@/lib/openai/client'
import { generateTurn, transcribe } from '@/lib/openai/conversation'
import { getLanguage } from '@/lib/languages'
import { rateLimit } from '@/lib/rate-limit'

const MAX_AUDIO_BYTES = 25 * 1024 * 1024 // OpenAI's own upload ceiling

/*
 * OpenAI reads the format from the file name, so the extension has to match the
 * bytes. Browsers disagree about what they record: Chrome and Edge produce
 * webm/opus, Safari mp4, Firefox ogg. Sending any of them as ".webm" gets a
 * flat "audio file might be corrupted or unsupported" back.
 */
const EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4',
  'audio/x-m4a': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/mpga': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/flac': 'flac',
}
const ACCEPTED = Object.keys(EXTENSIONS)

/**
 * One turn of the conversation: the learner's audio in, the teacher's words and
 * the on-screen corrections out. The heavy work stays here on the server, so
 * the API key never reaches the browser.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const conversation = await getOwnedConversation(user.id, id)
  if (!conversation) return Response.json({ error: 'Conversa não encontrada' }, { status: 404 })
  if (conversation.status !== 'active') {
    return Response.json({ error: 'Esta sessão já foi encerrada.' }, { status: 409 })
  }

  const limit = rateLimit(`turn:${user.id}`, 90, 5 * 60_000)
  if (!limit.ok) {
    return Response.json(
      { error: 'Falas demais em pouco tempo. Espere alguns segundos.' },
      { status: 429 },
    )
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: 'Era esperado um envio de áudio.' }, { status: 400 })
  }

  const audio = form.get('audio')
  if (!(audio instanceof File)) {
    return Response.json({ error: 'Era esperado um envio de áudio.' }, { status: 400 })
  }
  if (audio.size === 0) return Response.json({ error: 'A gravação estava vazia.' }, { status: 400 })
  if (audio.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: 'Essa gravação é longa demais.' }, { status: 413 })
  }

  const mime = (audio.type || '').split(';')[0]
  if (mime && !ACCEPTED.includes(mime)) {
    return Response.json({ error: `Unsupported audio format: ${mime}` }, { status: 415 })
  }

  const audioMs = Number(form.get('audioMs')) || null

  try {
    const ai = await getUserAi(user.id)

    const extension = EXTENSIONS[mime] ?? 'webm'
    const file = new File([await audio.arrayBuffer()], `turn.${extension}`, {
      type: mime || 'audio/webm',
    })

    const transcript = await transcribe(ai, file, getLanguage(conversation.language).sttCode)
    // Nothing intelligible: tell the client so it can prompt a retry without
    // polluting the transcript or spending a chat call.
    if (transcript.replace(/[^\p{L}\p{N}]/gu, '').length < 2) {
      return Response.json({ empty: true }, { status: 200 })
    }

    /*
     * `seq` does not depend on the reply, so it is fetched while the model is
     * still writing. Every round trip to the database costs real waiting time
     * for someone mid-conversation.
     */
    const [prompt, history] = await Promise.all([
      buildPromptFor(conversation.workspaceId, user.name, conversation),
      conversationHistory(conversation.id),
    ])

    const [turn, seq] = await Promise.all([
      generateTurn(ai, { systemPrompt: prompt, history, userText: transcript }),
      nextSeq(conversation.id),
    ])

    const { user: userMessage, assistant: assistantMessage } = await appendTurn({
      conversationId: conversation.id,
      userId: user.id,
      seq,
      userContent: transcript,
      assistantContent: turn.reply,
      audioMs,
    })

    const saved = await saveCorrections({
      userId: user.id,
      conversationId: conversation.id,
      messageId: userMessage.id,
      items: turn.corrections,
    })

    /*
     * The recurring-mistake ledger and the turn counter are not on screen yet,
     * so they run once the reply is on its way. The learner gets the teacher's
     * answer without waiting for bookkeeping.
     */
    after(async () => {
      await recordMistakes(
        user.id,
        conversation.workspaceId,
        conversation.id,
        turn.corrections.map((correction) => ({
          category: correction.category,
          original: correction.original,
          corrected: correction.corrected,
          explanation: correction.explanation,
          sentence: transcript.slice(0, 400),
        })),
      )

      await db
        .update(conversations)
        .set({ userTurns: sql`${conversations.userTurns} + 1` })
        .where(eq(conversations.id, conversation.id))
    })

    return Response.json({
      userMessage: { id: userMessage.id, content: userMessage.content, seq: userMessage.seq },
      assistantMessage: {
        id: assistantMessage.id,
        content: assistantMessage.content,
        seq: assistantMessage.seq,
      },
      corrections: saved.map((correction) => ({
        id: correction.id,
        messageId: correction.messageId,
        category: correction.category,
        original: correction.original,
        corrected: correction.corrected,
        explanation: correction.explanation,
        betterSentence: correction.betterSentence,
        severity: correction.severity,
      })),
      levelSignal: turn.levelSignal,
    })
  } catch (error) {
    const aiError = toAiError(error)
    return Response.json({ error: aiError.message }, { status: aiError.status })
  }
}
