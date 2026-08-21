'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'

import { getProfile, requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { conversations } from '@/lib/db/schema'
import { appendMessage, buildPromptFor, nextSeq } from '@/lib/domain/conversation'
import { registerPractice, XP } from '@/lib/domain/gamification'
import { TOPIC_BY_ID } from '@/lib/domain/topics'
import { getUserAi, toAiError } from '@/lib/openai/client'
import { generateTurn } from '@/lib/openai/conversation'
import { rateLimit } from '@/lib/rate-limit'
import { dayFrom } from '@/lib/utils'
import { fieldErrors, startConversationSchema } from '@/lib/validation'

export type StartState = { errors?: Record<string, string> } | undefined

/**
 * Creates the conversation and generates the teacher's opening line before
 * navigating, so the room is never an empty screen.
 */
export async function startConversation(
  _prev: StartState,
  formData: FormData,
): Promise<StartState> {
  const user = await requireUser()

  const limit = rateLimit(`start:${user.id}`, 20, 10 * 60_000)
  if (!limit.ok) return { errors: { form: 'You have started a lot of sessions. Take a breath.' } }

  const parsed = startConversationSchema.safeParse({
    topicId: (formData.get('topicId') as string) || null,
    customBrief: (formData.get('customBrief') as string) || null,
    level: (formData.get('level') as string) || undefined,
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const topic = parsed.data.topicId ? TOPIC_BY_ID.get(parsed.data.topicId) : undefined
  const custom = parsed.data.customBrief?.trim() || null

  if (!topic && !custom) {
    return { errors: { form: 'Pick a topic or describe what you want to talk about.' } }
  }

  const profile = await getProfile(user.id)
  const level = parsed.data.level ?? profile.level

  const conversation = db
    .insert(conversations)
    .values({
      userId: user.id,
      topicId: topic?.id ?? null,
      topicLabel: topic?.label ?? custom!.slice(0, 80),
      category: topic?.category ?? 'custom',
      customBrief: custom,
      level,
      status: 'active',
    })
    .returning({ id: conversations.id })
    .get()

  try {
    const ai = getUserAi(user.id)
    const prompt = buildPromptFor(user.id, user.name, {
      topicId: topic?.id ?? null,
      topicLabel: topic?.label ?? custom!,
      customBrief: custom,
      level,
    })

    const opening = await generateTurn(ai, { systemPrompt: prompt, history: [], userText: null })

    appendMessage({
      conversationId: conversation.id,
      userId: user.id,
      role: 'assistant',
      content: opening.reply,
      seq: nextSeq(conversation.id),
    })
  } catch (error) {
    // No opening line means no session: remove the empty shell we just created.
    db.delete(conversations).where(eq(conversations.id, conversation.id)).run()
    return { errors: { form: toAiError(error).message } }
  }

  registerPractice({
    userId: user.id,
    kind: 'conversation',
    seconds: 0,
    xp: XP.startSession,
    conversationId: conversation.id,
    countsAsSession: false,
    day: dayFrom(formData.get('tzOffset')),
  })

  revalidatePath('/dashboard')
  redirect(`/speak/${conversation.id}`)
}

/** Drops an active session that never got going. */
export async function discardConversation(conversationId: string) {
  const user = await requireUser()

  db.delete(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, user.id),
        eq(conversations.status, 'active'),
      ),
    )
    .run()

  revalidatePath('/sessions')
  redirect('/speak')
}
