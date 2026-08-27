import { getCurrentUser } from '@/lib/auth/session'
import { getUserAi, toAiError } from '@/lib/openai/client'
import { speak } from '@/lib/openai/speech'
import { rateLimit } from '@/lib/rate-limit'
import { isVoiceId, VOICE_SAMPLE } from '@/lib/voices'

/**
 * Auditions a voice before it is saved.
 *
 * A GET keyed by the voice id so the browser caches each sample: trying a voice
 * a second time costs the learner nothing. Every miss is a real text-to-speech
 * call billed to their own OpenAI account, which is why the sample is one short
 * sentence and the endpoint is rate limited.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const voice = new URL(request.url).searchParams.get('voice') ?? ''
  if (!isVoiceId(voice)) {
    return Response.json({ error: 'Unknown voice.' }, { status: 400 })
  }

  const limit = rateLimit(`voice-preview:${user.id}`, 30, 5 * 60_000)
  if (!limit.ok) {
    return Response.json({ error: 'Prévias demais. Espere um pouco.' }, { status: 429 })
  }

  try {
    const stream = await speak(await getUserAi(user.id), VOICE_SAMPLE, voice)

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
