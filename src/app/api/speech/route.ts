import { and, eq } from 'drizzle-orm'

import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { conversationMessages } from '@/lib/db/schema'
import { getUserAi, toAiError } from '@/lib/openai/client'
import { speak } from '@/lib/openai/speech'
import { rateLimit } from '@/lib/rate-limit'

/**
 * Streams the teacher's voice for one stored message. A GET keyed by message id
 * lets the browser play it natively as it arrives, and lets a replay come from
 * cache instead of billing another request.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const messageId = new URL(request.url).searchParams.get('messageId')
  if (!messageId) return Response.json({ error: 'messageId is required' }, { status: 400 })

  const message = db
    .select({ content: conversationMessages.content, role: conversationMessages.role })
    .from(conversationMessages)
    .where(
      and(eq(conversationMessages.id, messageId), eq(conversationMessages.userId, user.id)),
    )
    .get()

  if (!message) return Response.json({ error: 'Message not found' }, { status: 404 })
  if (message.role !== 'assistant') {
    return Response.json({ error: 'Only the teacher can be played back.' }, { status: 400 })
  }

  const limit = rateLimit(`tts:${user.id}`, 120, 5 * 60_000)
  if (!limit.ok) return Response.json({ error: 'Too many requests.' }, { status: 429 })

  try {
    const stream = await speak(getUserAi(user.id), message.content)

    return new Response(stream, {
      headers: {
        'Content-Type': 'audio/mpeg',
        // Private so a shared cache never holds one learner's audio.
        'Cache-Control': 'private, max-age=86400',
      },
    })
  } catch (error) {
    const aiError = toAiError(error)
    return Response.json({ error: aiError.message }, { status: aiError.status })
  }
}
