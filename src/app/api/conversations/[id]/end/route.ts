import { getCurrentUser } from '@/lib/auth/session'
import { getOwnedConversation } from '@/lib/domain/conversation'
import { finishConversation } from '@/lib/domain/report'
import { getUserAi, toAiError } from '@/lib/openai/client'
import { rateLimit } from '@/lib/rate-limit'
import { dayFrom } from '@/lib/utils'
import { endConversationSchema } from '@/lib/validation'

/** Ends a session and returns the id of the report the client should open. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const { id } = await params
  const conversation = await getOwnedConversation(user.id, id)
  if (!conversation) return Response.json({ error: 'Conversation not found' }, { status: 404 })

  const limit = rateLimit(`end:${user.id}`, 20, 5 * 60_000)
  if (!limit.ok) return Response.json({ error: 'Too many requests.' }, { status: 429 })

  const body = await request.json().catch(() => null)
  const parsed = endConversationSchema.safeParse({
    durationSeconds: Number(body?.durationSeconds ?? 0),
  })
  if (!parsed.success) return Response.json({ error: 'Invalid duration.' }, { status: 400 })

  try {
    const result = await finishConversation({
      ai: await getUserAi(user.id),
      userId: user.id,
      learnerName: user.name,
      conversationId: conversation.id,
      durationSeconds: parsed.data.durationSeconds,
      day: dayFrom(body?.tzOffset),
    })

    return Response.json(result)
  } catch (error) {
    const aiError = toAiError(error)
    return Response.json({ error: aiError.message }, { status: aiError.status })
  }
}
