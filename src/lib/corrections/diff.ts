/**
 * Working out which words in a correction actually changed.
 *
 * The model is asked for the shortest possible quote, but it does not always
 * oblige: rewriting a clause for naturalness tends to come back as the whole
 * sentence on both sides, so a learner sees a wall of struck-through text to
 * fix three words. This finds the real edits, which is used twice — to trim the
 * stored pair down to the region that differs, and to render only the changed
 * words as changed.
 *
 * Pure and dependency-free so it can be tested directly.
 */

export type Piece = { text: string; changed: boolean }

type Token = { text: string; start: number; end: number }

const tokenize = (value: string): Token[] =>
  [...value.matchAll(/\S+/gu)].map((match) => ({
    text: match[0],
    start: match.index,
    end: match.index + match[0].length,
  }))

/*
 * Words are matched on their letters, so a comma moving around does not count
 * as an edit. Apostrophes stay in: "I've" and "I have" are a real difference.
 * Punctuation-only tokens keep their raw form so they can still match.
 */
const keyOf = (token: Token) => {
  const stripped = token.text.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, '')
  return stripped || token.text
}

/**
 * Marks each token as changed or untouched, by aligning the two word sequences
 * on their longest common subsequence.
 */
function align(a: Token[], b: Token[]): { changedA: boolean[]; changedB: boolean[] } {
  const keysA = a.map(keyOf)
  const keysB = b.map(keyOf)

  // dp[i][j] = length of the longest common subsequence of a[i…] and b[j…].
  const dp: Uint16Array[] = Array.from(
    { length: a.length + 1 },
    () => new Uint16Array(b.length + 1),
  )
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      dp[i][j] =
        keysA[i] === keysB[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const changedA = new Array<boolean>(a.length).fill(true)
  const changedB = new Array<boolean>(b.length).fill(true)

  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (keysA[i] === keysB[j]) {
      changedA[i] = false
      changedB[j] = false
      i += 1
      j += 1
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i += 1
    else j += 1
  }

  return { changedA, changedB }
}

/**
 * Splits a string into runs of changed and untouched text. The pieces
 * concatenate back to the original exactly, so nothing is lost in rendering.
 */
function toPieces(value: string, tokens: Token[], changed: boolean[]): Piece[] {
  if (tokens.length === 0) return value ? [{ text: value, changed: false }] : []

  const pieces: Piece[] = []
  let cursor = 0
  let groupStart = 0

  const flush = (endToken: number, end: number) => {
    const text = value.slice(cursor, end)
    if (text) pieces.push({ text, changed: changed[groupStart] })
    cursor = end
    groupStart = endToken
  }

  for (let index = 1; index < tokens.length; index += 1) {
    // Whitespace between two runs belongs to the one that ends here.
    if (changed[index] !== changed[index - 1]) flush(index, tokens[index].start)
  }
  flush(tokens.length, value.length)

  return pieces
}

/** The changed and untouched runs of both sides of a correction. */
export function diffCorrection(
  original: string,
  corrected: string,
): { original: Piece[]; corrected: Piece[] } {
  const a = tokenize(original)
  const b = tokenize(corrected)
  const { changedA, changedB } = align(a, b)

  /*
   * Two strings that differ only in punctuation align perfectly and would
   * render as though nothing changed at all. Show the whole pair instead.
   */
  if (!changedA.some(Boolean) && !changedB.some(Boolean)) {
    return {
      original: original ? [{ text: original, changed: true }] : [],
      corrected: corrected ? [{ text: corrected, changed: true }] : [],
    }
  }

  return {
    original: toPieces(original, a, changedA),
    corrected: toPieces(corrected, b, changedB),
  }
}

/**
 * Cuts a correction down to the stretch that actually differs, dropping the
 * shared run of words at each end.
 *
 * Only trims — never rewrites — so the result is still an exact substring of
 * what the learner said and can still be found in the transcript.
 */
export function narrowCorrection(
  original: string,
  corrected: string,
): { original: string; corrected: string } {
  const a = tokenize(original)
  const b = tokenize(corrected)
  if (a.length === 0 || b.length === 0) return { original, corrected }

  const keysA = a.map(keyOf)
  const keysB = b.map(keyOf)

  let head = 0
  while (head < a.length && head < b.length && keysA[head] === keysB[head]) head += 1

  let tail = 0
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    keysA[a.length - 1 - tail] === keysB[b.length - 1 - tail]
  ) {
    tail += 1
  }

  if (head === 0 && tail === 0) return { original, corrected }

  let startA = head
  let startB = head
  let endA = a.length - tail
  let endB = b.length - tail

  /*
   * A pure insertion or deletion empties one side. An empty quote reads as
   * nothing and cannot be located in the transcript, so keep one word of
   * anchor — behind if there is any, otherwise ahead.
   */
  if (startA >= endA || startB >= endB) {
    if (head > 0) {
      startA -= 1
      startB -= 1
    } else if (endA < a.length && endB < b.length) {
      endA += 1
      endB += 1
    } else {
      return { original, corrected }
    }
  }

  const slice = (value: string, tokens: Token[], start: number, end: number) =>
    value.slice(tokens[start].start, tokens[end - 1].end)

  const nextOriginal = slice(original, a, startA, endA)
  const nextCorrected = slice(corrected, b, startB, endB)

  // Never hand back a pair that no longer shows a difference.
  if (!nextOriginal || !nextCorrected) return { original, corrected }
  if (nextOriginal.toLowerCase() === nextCorrected.toLowerCase()) return { original, corrected }

  return { original: nextOriginal, corrected: nextCorrected }
}
