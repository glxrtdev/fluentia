import { getCurrentUser } from '@/lib/auth/session'
import { getUserAi, toAiError } from '@/lib/openai/client'
import { speak } from '@/lib/openai/speech'
import { rateLimit } from '@/lib/rate-limit'
import { dictionaryQuerySchema } from '@/lib/validation'

/**
 * Says a single word out loud.
 *
 * The dictionary lists human recordings, but its media host is unreliable and
 * many entries have no audio at all. This is the fallback that always works, so
 * "how do I say this?" never ends in silence.
 *
 * A GET keyed by the word so the browser caches each pronunciation: hearing a
 * word twice costs the learner nothing.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const parsed = dictionaryQuerySchema.safeParse(new URL(request.url).searchParams.get('word') ?? '')
  if (!parsed.success) {
    return Response.json({ error: 'Peça uma única palavra.' }, { status: 400 })
  }

  const limit = rateLimit(`say:${user.id}`, 60, 5 * 60_000)
  if (!limit.ok) return Response.json({ error: 'Too many requests.' }, { status: 429 })

  try {
    const stream = await speak(await getUserAi(user.id), parsed.data)

    return new Response(stream, {
      headers: {
        'Content-Type': 'audio/mpeg',
        // Private so a shared cache never holds one learner's audio.
        'Cache-Control': 'private, max-age=604800',
      },
    })
  } catch (error) {
    const aiError = toAiError(error)
    return Response.json({ error: aiError.message }, { status: aiError.status })
  }
}
