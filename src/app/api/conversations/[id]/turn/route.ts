import { eq, sql } from 'drizzle-orm'

import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { conversations } from '@/lib/db/schema'
import {
  appendMessage,
  buildPromptFor,
  conversationHistory,
  getOwnedConversation,
  nextSeq,
  saveCorrections,
} from '@/lib/domain/conversation'
import { recordMistakes } from '@/lib/domain/mistakes'
import { getUserAi, toAiError } from '@/lib/openai/client'
import { generateTurn, transcribe } from '@/lib/openai/conversation'
import { rateLimit } from '@/lib/rate-limit'

const MAX_AUDIO_BYTES = 25 * 1024 * 1024 // OpenAI's own upload ceiling
const ACCEPTED = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-m4a']

/**
 * One turn of the conversation: the learner's audio in, the teacher's words and
 * the on-screen corrections out. The heavy work stays here on the server, so
 * the API key never reaches the browser.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const { id } = await params
  const conversation = getOwnedConversation(user.id, id)
  if (!conversation) return Response.json({ error: 'Conversation not found' }, { status: 404 })
  if (conversation.status !== 'active') {
    return Response.json({ error: 'This session has already ended.' }, { status: 409 })
  }

  const limit = rateLimit(`turn:${user.id}`, 90, 5 * 60_000)
  if (!limit.ok) {
    return Response.json(
      { error: 'Too many turns too quickly. Give it a few seconds.' },
      { status: 429 },
    )
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: 'Expected an audio upload.' }, { status: 400 })
  }

  const audio = form.get('audio')
  if (!(audio instanceof File)) {
    return Response.json({ error: 'Expected an audio upload.' }, { status: 400 })
  }
  if (audio.size === 0) return Response.json({ error: 'The recording was empty.' }, { status: 400 })
  if (audio.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: 'That recording is too long.' }, { status: 413 })
  }

  const mime = (audio.type || '').split(';')[0]
  if (mime && !ACCEPTED.includes(mime)) {
    return Response.json({ error: `Unsupported audio format: ${mime}` }, { status: 415 })
  }

  const audioMs = Number(form.get('audioMs')) || null

  try {
    const ai = getUserAi(user.id)

    const extension = mime === 'audio/mp4' || mime === 'audio/x-m4a' ? 'mp4' : 'webm'
    const file = new File([await audio.arrayBuffer()], `turn.${extension}`, {
      type: mime || 'audio/webm',
    })

    const transcript = await transcribe(ai, file)
    // Nothing intelligible: tell the client so it can prompt a retry without
    // polluting the transcript or spending a chat call.
    if (transcript.replace(/[^\p{L}\p{N}]/gu, '').length < 2) {
      return Response.json({ empty: true }, { status: 200 })
    }

    const prompt = buildPromptFor(user.id, user.name, conversation)
    const turn = await generateTurn(ai, {
      systemPrompt: prompt,
      history: conversationHistory(conversation.id),
      userText: transcript,
    })

    const seq = nextSeq(conversation.id)
    const userMessage = appendMessage({
      conversationId: conversation.id,
      userId: user.id,
      role: 'user',
      content: transcript,
      seq,
      audioMs,
    })
    const assistantMessage = appendMessage({
      conversationId: conversation.id,
      userId: user.id,
      role: 'assistant',
      content: turn.reply,
      seq: seq + 1,
    })

    const saved = saveCorrections({
      userId: user.id,
      conversationId: conversation.id,
      messageId: userMessage.id,
      items: turn.corrections,
    })

    // Recurring-mistake ledger updates live, so it survives an abandoned session.
    recordMistakes(
      user.id,
      conversation.id,
      turn.corrections.map((correction) => ({
        category: correction.category,
        original: correction.original,
        corrected: correction.corrected,
        explanation: correction.explanation,
        sentence: transcript.slice(0, 400),
      })),
    )

    db.update(conversations)
      .set({ userTurns: sql`${conversations.userTurns} + 1` })
      .where(eq(conversations.id, conversation.id))
      .run()

    return Response.json({
      userMessage: { id: userMessage.id, content: userMessage.content, seq: userMessage.seq },
      assistantMessage: {
        id: assistantMessage.id,
        content: assistantMessage.content,
        seq: assistantMessage.seq,
      },
      corrections: saved.map((correction) => ({
        id: correction.id,
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
