/**
 * Definitions for every language Fluentia teaches.
 *
 * dictionaryapi.dev publishes endpoints for a dozen languages, but only the
 * English one actually answers — the rest time out at the origin. Wiktionary's
 * REST API does answer, for all of them, and keys its response by language
 * code, which is exactly the shape a workspace needs.
 *
 * One catch worth knowing: the definitions themselves come back in English,
 * because only the English Wiktionary implements this endpoint. Saving a word
 * still hands it to the existing translation route, so a learner reading in
 * Portuguese gets there in one more step.
 *
 * The parsing is pure and exported so it can be tested without the network.
 */

import type { DictionaryEntry, DictionaryMeaning } from './types'

/** What the endpoint returns: language code → the senses listed under it. */
type WiktionaryPayload = Record<
  string,
  {
    partOfSpeech?: unknown
    language?: unknown
    definitions?: { definition?: unknown; examples?: unknown; parsedExamples?: unknown }[]
  }[]
>

/*
 * Wiktionary marks up its definitions: links to other entries, italics for
 * usage labels, and the occasional list. None of that survives as text, so it
 * is unwrapped rather than escaped and shown.
 */
const stripMarkup = (value: string) =>
  value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    // Unwrapping a tag leaves a space where it stood, which reads fine between
    // words and wrong before a full stop: "Vivo en una casa ."
    .replace(/\s+([.,;:!?)\]}»、。！？])/g, '$1')
    .replace(/([(\[{«])\s+/g, '$1')
    .trim()

const text = (value: unknown): string => (typeof value === 'string' ? stripMarkup(value) : '')

/**
 * Picks the senses written in the language being learned.
 *
 * A page for "casa" carries entries for a dozen languages at once. Showing a
 * Spanish learner the Galician meaning would be worse than showing nothing.
 */
export function normaliseWiktionary(
  word: string,
  languageCode: string,
  payload: unknown,
): DictionaryEntry | null {
  if (!payload || typeof payload !== 'object') return null

  const sections = (payload as WiktionaryPayload)[languageCode]
  if (!Array.isArray(sections) || sections.length === 0) return null

  const meanings: DictionaryMeaning[] = []

  for (const section of sections) {
    const senses = (Array.isArray(section?.definitions) ? section.definitions : [])
      .map((entry) => {
        const definition = text(entry?.definition)
        const examples = Array.isArray(entry?.examples) ? entry.examples : []
        return { definition, example: text(examples[0]) || null }
      })
      .filter((sense) => sense.definition.length > 0)
      .slice(0, 6)

    if (senses.length === 0) continue

    meanings.push({
      partOfSpeech: text(section?.partOfSpeech).toLowerCase() || 'word',
      senses,
      // Wiktionary's REST shape carries no synonym or antonym lists.
      synonyms: [],
      antonyms: [],
    })
  }

  if (meanings.length === 0) return null

  return {
    word,
    // No transcription and no recordings in this endpoint. The app falls back
    // to its own speech for pronunciation, which it already does when the
    // English dictionary's media host is down.
    phonetic: null,
    audioUrl: null,
    meanings: meanings.slice(0, 4),
    synonyms: [],
    antonyms: [],
    source: 'wiktionary',
  }
}

export const wiktionaryUrl = (word: string) =>
  `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`
