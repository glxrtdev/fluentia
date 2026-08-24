/**
 * Locating a correction inside the sentence the learner actually said.
 *
 * Pure and dependency-free so it can be tested directly: getting this wrong
 * means underlining the wrong words, which is worse than underlining none.
 */
export type Markable = { id: string; original: string }

export type MarkSpan<T extends Markable> = { start: number; end: number; item: T }

/** Loose form: the model quotes the learner, but casing and punctuation drift. */
const normalise = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function locateMarks<T extends Markable>(content: string, items: T[]): MarkSpan<T>[] {
  const spans: MarkSpan<T>[] = []

  for (const item of items) {
    const needle = item.original.trim()
    if (!needle) continue

    let start = content.toLowerCase().indexOf(needle.toLowerCase())
    let end = start + needle.length

    if (start < 0) {
      // Rebuild the match from word positions when punctuation differs.
      const words = normalise(needle).split(' ').filter(Boolean)
      if (words.length === 0) continue

      const pattern = new RegExp(words.map(escapeRegExp).join('[^\\p{L}\\p{N}]+'), 'iu')
      const match = pattern.exec(content)
      if (!match) continue

      start = match.index
      end = start + match[0].length
    }

    spans.push({ start, end, item })
  }

  // Overlapping highlights would nest badly; the earliest one wins.
  return spans
    .sort((a, b) => a.start - b.start)
    .filter((span, index, all) => index === 0 || span.start >= all[index - 1].end)
}
