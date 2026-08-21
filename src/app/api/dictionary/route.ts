import { getCurrentUser } from '@/lib/auth/session'
import { rateLimit } from '@/lib/rate-limit'
import { dictionaryQuerySchema } from '@/lib/validation'

const ENDPOINT = 'https://api.dictionaryapi.dev/api/v2/entries/en'

// Definitions barely change; an in-process day cache keeps repeat lookups instant.
const cache = new Map<string, { expires: number; result: DictionaryResult }>()

type ApiEntry = {
  word?: string
  phonetic?: string
  phonetics?: { text?: string; audio?: string }[]
  meanings?: {
    partOfSpeech?: string
    definitions?: { definition?: string; example?: string }[]
    synonyms?: string[]
    antonyms?: string[]
  }[]
}

export type DictionaryResult = {
  word: string
  phonetic: string | null
  audioUrl: string | null
  definitions: { partOfSpeech: string; definition: string; example: string | null }[]
  related: string[]
}

/**
 * Definitions come from a real dictionary (dictionaryapi.dev), not from the
 * model — a language app should not invent what a word means.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const parsed = dictionaryQuerySchema.safeParse(
    new URL(request.url).searchParams.get('word') ?? '',
  )
  if (!parsed.success) {
    return Response.json({ error: 'Search a single English word.' }, { status: 400 })
  }

  const limit = rateLimit(`dict:${user.id}`, 60, 60_000)
  if (!limit.ok) return Response.json({ error: 'Too many lookups.' }, { status: 429 })

  const word = parsed.data.toLowerCase()

  const cached = cache.get(word)
  if (cached && cached.expires > Date.now()) return Response.json(cached.result)

  let response: Response
  try {
    response = await fetch(`${ENDPOINT}/${encodeURIComponent(word)}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    return Response.json({ error: 'The dictionary is unreachable right now.' }, { status: 502 })
  }

  if (response.status === 404) {
    return Response.json({ error: `No dictionary entry for "${word}".` }, { status: 404 })
  }
  if (!response.ok) {
    return Response.json({ error: 'The dictionary returned an error.' }, { status: 502 })
  }

  const entries = (await response.json()) as ApiEntry[]
  if (!Array.isArray(entries) || entries.length === 0) {
    return Response.json({ error: `No dictionary entry for "${word}".` }, { status: 404 })
  }

  const definitions: DictionaryResult['definitions'] = []
  const related = new Set<string>()
  let phonetic: string | null = null
  let audioUrl: string | null = null

  for (const entry of entries) {
    phonetic ??= entry.phonetic?.trim() || entry.phonetics?.find((p) => p.text)?.text?.trim() || null
    audioUrl ??= entry.phonetics?.find((p) => p.audio)?.audio ?? null

    for (const meaning of entry.meanings ?? []) {
      for (const definition of meaning.definitions ?? []) {
        if (!definition.definition || definitions.length >= 8) continue
        definitions.push({
          partOfSpeech: meaning.partOfSpeech ?? 'unknown',
          definition: definition.definition,
          example: definition.example ?? null,
        })
      }
      for (const synonym of meaning.synonyms ?? []) {
        if (related.size < 12) related.add(synonym)
      }
    }
  }

  if (definitions.length === 0) {
    return Response.json({ error: `No usable definition for "${word}".` }, { status: 404 })
  }

  const result: DictionaryResult = {
    word: entries[0].word ?? word,
    phonetic,
    audioUrl: audioUrl && audioUrl.startsWith('http') ? audioUrl : null,
    definitions,
    related: [...related],
  }

  if (cache.size > 500) cache.clear()
  cache.set(word, { expires: Date.now() + 86_400_000, result })

  return Response.json(result)
}
