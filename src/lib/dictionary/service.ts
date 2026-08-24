import 'server-only'

import { normaliseEntries } from './normalise'
import type { DictionaryEntry, LookupResult } from './types'

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
 * The single place the app talks to dictionaryapi.dev.
 *
 * Returns a tagged result rather than throwing, so callers can turn each
 * failure into the right status and message without catching.
 */
export async function lookupWord(term: string): Promise<LookupResult> {
  const word = term.trim().toLowerCase()

  if (!word) {
    return { ok: false, reason: 'not-found', message: 'Search for a word.' }
  }

  const cached = cache.get(word)
  if (cached && cached.expires > Date.now()) return { ok: true, entry: cached.entry }

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

  if (!response) {
    return {
      ok: false,
      reason: 'unreachable',
      message: 'The dictionary is not responding right now. Try again in a moment.',
    }
  }

  if (response.status === 404) {
    return { ok: false, reason: 'not-found', message: `No dictionary entry for "${word}".` }
  }

  if (!response.ok) {
    console.warn(`dictionary: ${word} failed with upstream ${response.status}`)
    return {
      ok: false,
      reason: 'upstream',
      message: 'The dictionary is having a bad moment. Try again in a few seconds.',
    }
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    return { ok: false, reason: 'upstream', message: 'The dictionary sent something unreadable.' }
  }

  const entry = normaliseEntries(payload)
  if (!entry) {
    return { ok: false, reason: 'not-found', message: `No usable definition for "${word}".` }
  }

  if (cache.size >= MAX_ENTRIES) cache.clear()
  cache.set(word, { expires: Date.now() + TTL_MS, entry })

  return { ok: true, entry }
}
