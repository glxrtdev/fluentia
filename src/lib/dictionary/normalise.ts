import type { DictionaryEntry, DictionaryMeaning, DictionarySense } from './types'

/** The subset of the dictionaryapi.dev payload the app relies on. */
export type RawEntry = {
  word?: unknown
  phonetic?: unknown
  phonetics?: unknown
  meanings?: unknown
}

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const asText = (value: unknown, max: number): string | null => {
  const text = typeof value === 'string' ? value.trim() : ''
  return text ? text.slice(0, max) : null
}

/** Trimmed, de-duplicated, case-insensitively unique word list. */
function wordList(values: unknown[], limit: number): string[] {
  const seen = new Map<string, string>()

  for (const value of values) {
    const word = asText(value, 60)
    if (!word) continue
    const key = word.toLowerCase()
    if (!seen.has(key)) seen.set(key, word)
    if (seen.size >= limit) break
  }

  return [...seen.values()]
}

const MAX_MEANINGS = 6
const MAX_SENSES = 6
const MAX_RELATED = 12

/**
 * Turns the upstream payload into the app's own shape.
 *
 * Pure and defensive: the API is free and community-maintained, so every field
 * is treated as possibly missing or the wrong type. Anything unusable is
 * dropped rather than guessed at.
 *
 * dictionaryapi.dev lists synonyms and antonyms twice — once per part of speech
 * and once per individual sense. Both are merged onto the part of speech, which
 * is how a reader expects to see them.
 */
export function normaliseEntries(payload: unknown): DictionaryEntry | null {
  const entries = asArray(payload).map(asRecord)
  if (entries.length === 0) return null

  const meanings: DictionaryMeaning[] = []
  const allSynonyms: unknown[] = []
  const allAntonyms: unknown[] = []

  let word: string | null = null
  let phonetic: string | null = null
  let audioUrl: string | null = null

  for (const entry of entries) {
    word ??= asText(entry.word, 60)
    phonetic ??= asText(entry.phonetic, 80)

    for (const raw of asArray(entry.phonetics).map(asRecord)) {
      phonetic ??= asText(raw.text, 80)
      if (!audioUrl) {
        const audio = asText(raw.audio, 500)
        if (audio?.startsWith('http')) audioUrl = audio
      }
    }

    for (const rawMeaning of asArray(entry.meanings).map(asRecord)) {
      if (meanings.length >= MAX_MEANINGS) break

      const senses: DictionarySense[] = []
      const synonyms: unknown[] = [...asArray(rawMeaning.synonyms)]
      const antonyms: unknown[] = [...asArray(rawMeaning.antonyms)]

      for (const rawSense of asArray(rawMeaning.definitions).map(asRecord)) {
        const definition = asText(rawSense.definition, 600)
        if (!definition || senses.length >= MAX_SENSES) continue

        senses.push({ definition, example: asText(rawSense.example, 400) })
        synonyms.push(...asArray(rawSense.synonyms))
        antonyms.push(...asArray(rawSense.antonyms))
      }

      if (senses.length === 0) continue

      allSynonyms.push(...synonyms)
      allAntonyms.push(...antonyms)

      meanings.push({
        partOfSpeech: asText(rawMeaning.partOfSpeech, 40) ?? 'unknown',
        senses,
        synonyms: wordList(synonyms, MAX_RELATED),
        antonyms: wordList(antonyms, MAX_RELATED),
      })
    }
  }

  if (!word || meanings.length === 0) return null

  return {
    word,
    phonetic,
    audioUrl,
    meanings,
    synonyms: wordList(allSynonyms, MAX_RELATED),
    antonyms: wordList(allAntonyms, MAX_RELATED),
    source: 'dictionaryapi.dev',
  }
}
