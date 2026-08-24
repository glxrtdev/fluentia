/**
 * The shape the app speaks in. Kept apart from the fetching so the normaliser
 * can be tested on its own, and so the client never sees the upstream JSON.
 */
export type DictionarySense = {
  definition: string
  example: string | null
}

export type DictionaryMeaning = {
  partOfSpeech: string
  senses: DictionarySense[]
  synonyms: string[]
  antonyms: string[]
}

export type DictionaryEntry = {
  word: string
  phonetic: string | null
  audioUrl: string | null
  meanings: DictionaryMeaning[]
  /** Every synonym across the entry, for saving alongside the word. */
  synonyms: string[]
  antonyms: string[]
  /** Where the definitions came from, shown as a credit in the UI. */
  source: 'dictionaryapi.dev'
}

export type LookupFailure =
  | { ok: false; reason: 'not-found'; message: string }
  | { ok: false; reason: 'unreachable'; message: string }
  | { ok: false; reason: 'upstream'; message: string }

export type LookupResult = { ok: true; entry: DictionaryEntry } | LookupFailure
