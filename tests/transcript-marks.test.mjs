import { test } from 'node:test'
import assert from 'node:assert/strict'

const { locateMarks } = await import('../src/lib/transcript-marks.ts')

const marked = (content, items) =>
  locateMarks(content, items).map((span) => content.slice(span.start, span.end))

test('marks the exact words the learner said', () => {
  const said = 'Yesterday I go to the university and make a presentation.'
  assert.deepEqual(
    marked(said, [
      { id: 'a', original: 'I go' },
      { id: 'b', original: 'make a presentation' },
    ]),
    ['I go', 'make a presentation'],
  )
})

test('ignores casing and punctuation drift in the quote', () => {
  assert.deepEqual(marked('I Go to work every day.', [{ id: 'a', original: 'i go' }]), ['I Go'])

  // The model quotes it clean; the transcript has a comma in the middle.
  assert.deepEqual(
    marked('I work in, this company since 2025.', [
      { id: 'a', original: 'I work in this company' },
    ]),
    ['I work in, this company'],
  )
})

test('marks nothing rather than the wrong words', () => {
  assert.deepEqual(marked('Something completely different.', [{ id: 'a', original: 'depend of' }]), [])
  assert.deepEqual(marked('Anything.', [{ id: 'a', original: '   ' }]), [])
})

test('overlapping quotes do not nest', () => {
  const spans = locateMarks('I have went there.', [
    { id: 'a', original: 'have went' },
    { id: 'b', original: 'went there' },
  ])
  assert.equal(spans.length, 1)
  assert.equal(spans[0].item.id, 'a')
})

test('regular expression characters in the quote are literal', () => {
  // A naive implementation throws or mismatches here.
  assert.deepEqual(marked('I use C++ (a lot).', [{ id: 'a', original: 'C++ (a lot)' }]), [
    'C++ (a lot)',
  ])
  assert.doesNotThrow(() => locateMarks('a [b] c', [{ id: 'a', original: '[b]' }]))
})

test('spans come back in reading order', () => {
  const said = 'She depend of him and I am agree with that.'
  const spans = locateMarks(said, [
    { id: 'second', original: 'I am agree' },
    { id: 'first', original: 'depend of' },
  ])
  assert.deepEqual(
    spans.map((span) => span.item.id),
    ['first', 'second'],
  )
})
