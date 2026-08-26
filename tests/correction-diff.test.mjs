import { test } from 'node:test'
import assert from 'node:assert/strict'

const { narrowCorrection, diffCorrection } = await import('../src/lib/corrections/diff.ts')

const narrow = (a, b) => {
  const result = narrowCorrection(a, b)
  return `${result.original} → ${result.corrected}`
}

/* ------------------------------------------------------------- narrowing */

test('drops the words both sides share at the front', () => {
  assert.equal(
    narrow('I have went to the shop', 'I have gone to the shop'),
    'went → gone',
  )
})

test('drops a shared ending too', () => {
  assert.equal(narrow('depend of you', 'depend on you'), 'of → on')
})

test('keeps a whole sentence when nothing is shared at the ends', () => {
  assert.equal(
    narrow('Me like this', 'I enjoy that'),
    'Me like this → I enjoy that',
  )
})

test('a pure deletion keeps a word of anchor rather than emptying a side', () => {
  const result = narrowCorrection('I am agree with you', 'I agree with you')
  assert.ok(result.original.length > 0)
  assert.ok(result.corrected.length > 0)
  assert.notEqual(result.original.toLowerCase(), result.corrected.toLowerCase())
})

test('a pure insertion at the front still anchors', () => {
  const result = narrowCorrection('go to school', 'I go to school')
  assert.ok(result.original.length > 0)
  assert.ok(result.corrected.length > 0)
})

test('the narrowed quote is still an exact substring of what was said', () => {
  const said = 'Yesterday I go to the university and make a presentation.'
  const { original } = narrowCorrection(
    'I go to the university and make a presentation',
    'I went to the university and gave a presentation',
  )
  assert.ok(said.includes(original), `"${original}" is not in the sentence`)
})

test('punctuation drift alone is not treated as a difference', () => {
  assert.equal(
    narrow('the network, and I have to learn', 'the networking, and I have to learn'),
    'network, → networking,',
  )
})

test('a long restructure loses its shared opening', () => {
  const said =
    "the most valuable part of this job I'm doing right now is the connection with people, the network, and I have to learn how to teach people"
  const fixed =
    "the most valuable part of this job I'm doing right now is the connection with people, the networking, and learning how to teach people"

  const result = narrowCorrection(said, fixed)
  assert.ok(
    result.original.length < said.length / 2,
    `expected a much shorter quote, got "${result.original}"`,
  )
  assert.ok(result.original.startsWith('network'))
  assert.ok(result.corrected.startsWith('networking'))
  assert.ok(said.includes(result.original))
})

/* ------------------------------------------------------------------ diff */

const changed = (pieces) => pieces.filter((piece) => piece.changed).map((piece) => piece.text.trim())

test('the pieces rebuild the original string exactly', () => {
  const said = 'I have went to the shop, and I buy some bread.'
  const fixed = 'I went to the shop and bought some bread.'
  const result = diffCorrection(said, fixed)

  assert.equal(result.original.map((piece) => piece.text).join(''), said)
  assert.equal(result.corrected.map((piece) => piece.text).join(''), fixed)
})

test('only the words that really changed are marked', () => {
  const result = diffCorrection('I have went to the shop', 'I have gone to the shop')
  assert.deepEqual(changed(result.original), ['went'])
  assert.deepEqual(changed(result.corrected), ['gone'])
})

test('untouched words in the middle stay untouched', () => {
  const result = diffCorrection(
    'I am agree with you because I never did this',
    "I agree with you because I've never done this",
  )
  const untouched = result.original
    .filter((piece) => !piece.changed)
    .map((piece) => piece.text)
    .join('')
  assert.ok(untouched.includes('with you because'))
})

test('a difference in punctuation only still shows something', () => {
  const result = diffCorrection('I went home', 'I went home!')
  assert.ok(result.original.some((piece) => piece.changed))
  assert.ok(result.corrected.some((piece) => piece.changed))
})

test('an empty side does not throw', () => {
  assert.doesNotThrow(() => diffCorrection('', 'something'))
  assert.doesNotThrow(() => narrowCorrection('', 'something'))
})
