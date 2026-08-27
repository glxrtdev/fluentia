import 'server-only'

import { getLanguage } from '@/lib/languages'

import { normaliseEntries } from './normalise'
import type { DictionaryEntry, LookupResult } from './types'
import { normaliseWiktionary, wiktionaryUrl } from './wiktionary'

const ENDPOINT = 'https://api.dictionaryapi.dev/api/v2/entries/en'
const TIMEOUT_MS = 8000

/** Three tries, spaced just enough to ride out a blip without stalling. */
const ATTEMPTS = 3
const BACKOFF_MS = [250, 700]
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/*
 * Definitions barely change, so a day in process keeps repeat lookups instant
 * and keeps a free community API from being hammered. Cleared wholesale rather
 * than evicted one by one — this is a cache, not a store.
 */
const TTL_MS = 24 * 60 * 60_000
const MAX_ENTRIES = 500
const cache = new Map<string, { expires: number; entry: DictionaryEntry }>()

/**
 * The single place the app looks a word up.
 *
 * English goes to dictionaryapi.dev first, for its phonetics, recordings and
 * synonyms, and falls back to Wiktionary when that flakes — which it does, with
 * 502s and origin timeouts on perfectly valid words. Every other language goes
 * straight to Wiktionary, because dictionaryapi.dev publishes those endpoints
 * but they never answer. Returns a tagged result
 * rather than throwing, so callers can turn each failure into the right status
 * and message without catching.
 */
export async function lookupWord(term: string, languageCode = 'en'): Promise<LookupResult> {
  const language = getLanguage(languageCode)

  // Only lowercase what lowercasing is meaningful for: German nouns are
  // capitalised, and scripts without case are unaffected either way.
  const trimmed = term.trim()
  const word = language.code === 'en' ? trimmed.toLowerCase() : trimmed

  if (!word) {
    return { ok: false, reason: 'not-found', message: 'Busque uma palavra.' }
  }

  const key = `${language.code}:${word.toLowerCase()}`
  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) return { ok: true, entry: cached.entry }

  if (!language.freeDictionary) return lookupInWiktionary(word, language.wiktionary, key)

  /*
   * dictionaryapi.dev is free and community-run, and it answers a noticeable
   * share of perfectly valid requests with a 502. Retrying turns "the
   * dictionary is broken" back into a definition. A 404 is an answer, not a
   * failure, so it is never retried.
   */
  let response: Response | null = null

  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    if (attempt > 0) await sleep(BACKOFF_MS[attempt - 1])

    try {
      response = await fetch(`${ENDPOINT}/${encodeURIComponent(word)}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch {
      response = null
      continue
    }

    if (response.status === 404 || response.ok) break
  }

  /*
   * dictionaryapi.dev being down used to mean no definition at all. Now that
   * Wiktionary is wired up for the other languages, English can fall back to it
   * too — a plainer entry beats an error message.
   */
  if (!response) return lookupInWiktionary(word, language.wiktionary, key)

  if (response.status === 404) {
    return { ok: false, reason: 'not-found', message: `No dictionary entry for "${word}".` }
  }

  if (!response.ok) {
    console.warn(`dictionary: ${word} failed with upstream ${response.status}, trying wiktionary`)
    return lookupInWiktionary(word, language.wiktionary, key)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    return lookupInWiktionary(word, language.wiktionary, key)
  }

  const entry = normaliseEntries(payload)
  if (!entry) return lookupInWiktionary(word, language.wiktionary, key)

  if (cache.size >= MAX_ENTRIES) cache.clear()
  cache.set(key, { expires: Date.now() + TTL_MS, entry })

  return { ok: true, entry }
}

/**
 * Wiktionary, for every language but English.
 *
 * Wikimedia's infrastructure is reliable enough that one attempt is honest —
 * the retries above exist for a specific community API that flakes, not as a
 * ritual.
 */
async function lookupInWiktionary(
  word: string,
  sectionCode: string,
  key: string,
): Promise<LookupResult> {
  let response: Response
  try {
    response = await fetch(wiktionaryUrl(word), {
      headers: {
        accept: 'application/json',
        // Wikimedia asks callers to identify themselves.
        'user-agent': 'Fluentia/1.0 (language learning app)',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    return {
      ok: false,
      reason: 'unreachable',
      message: 'O dicionário não está respondendo agora. Tente de novo em instantes.',
    }
  }

  if (response.status === 404) {
    return { ok: false, reason: 'not-found', message: `No dictionary entry for "${word}".` }
  }
  if (!response.ok) {
    console.warn(`wiktionary: ${word} failed with upstream ${response.status}`)
    return {
      ok: false,
      reason: 'upstream',
      message: 'O dicionário está com problemas. Tente de novo em alguns segundos.',
    }
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    return { ok: false, reason: 'upstream', message: 'O dicionário devolveu algo ilegível.' }
  }

  const entry = normaliseWiktionary(word, sectionCode, payload)
  if (!entry) {
    // The page exists but has no section in this language — for the learner
    // that is the same as the word not being there.
    return { ok: false, reason: 'not-found', message: `No definition for "${word}" in this language.` }
  }

  if (cache.size >= MAX_ENTRIES) cache.clear()
  cache.set(key, { expires: Date.now() + TTL_MS, entry })

  return { ok: true, entry }
}
