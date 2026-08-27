import { getActiveWorkspace, getCurrentUser } from '@/lib/auth/session'
import { lookupWord } from '@/lib/dictionary/service'
import { rateLimit } from '@/lib/rate-limit'
import { dictionaryQuerySchema } from '@/lib/validation'

/**
 * Definitions come from a real dictionary — dictionaryapi.dev for English,
 * Wiktionary for everything else — never from the model. A language app should
 * not invent what a word means.
 *
 * The lookup itself lives in `lib/dictionary`; this handler only deals with who
 * is asking, how often, and which status each failure deserves.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const parsed = dictionaryQuerySchema.safeParse(
    new URL(request.url).searchParams.get('word') ?? '',
  )
  if (!parsed.success) {
    return Response.json({ error: 'Busque uma única palavra.' }, { status: 400 })
  }

  const limit = rateLimit(`dict:${user.id}`, 60, 60_000)
  if (!limit.ok) return Response.json({ error: 'Buscas demais.' }, { status: 429 })

  // The word is looked up in the language of the space that is open.
  const workspace = await getActiveWorkspace(user.id)
  const result = await lookupWord(parsed.data, workspace?.language ?? 'en')

  if (result.ok) return Response.json(result.entry)

  const status = result.reason === 'not-found' ? 404 : 502
  return Response.json({ error: result.message, reason: result.reason }, { status })
}
