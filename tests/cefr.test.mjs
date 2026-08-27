import { test } from 'node:test'
import assert from 'node:assert/strict'

const { cefrForScore, CEFR_TO_LEVEL } = await import('../src/lib/domain/cefr.ts')

/* The bands, exactly as specified — including both edges of each one. */
const BANDS = [
  [0, 'A1'], [15, 'A1'], [29, 'A1'],
  [30, 'A2'], [37, 'A2'], [44, 'A2'],
  [45, 'B1'], [52, 'B1'], [59, 'B1'],
  [60, 'B2'], [67, 'B2'], [74, 'B2'],
  [75, 'C1'], [82, 'C1'], [89, 'C1'],
  [90, 'C2'], [95, 'C2'], [100, 'C2'],
]

test('every score lands in the band the table says', () => {
  for (const [score, expected] of BANDS) {
    assert.equal(cefrForScore(score), expected, `${score} should be ${expected}`)
  }
})

test('the boundaries belong to the upper band', () => {
  // The off-by-one that matters: 29/30, 44/45, 59/60, 74/75, 89/90.
  for (const [low, high] of [[29, 30], [44, 45], [59, 60], [74, 75], [89, 90]]) {
    assert.notEqual(
      cefrForScore(low),
      cefrForScore(high),
      `${low} and ${high} must not share a band`,
    )
  }
})

test('the whole 0-100 range is covered, with no gaps', () => {
  for (let score = 0; score <= 100; score += 1) {
    assert.ok(
      ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(cefrForScore(score)),
      `${score} produced ${cefrForScore(score)}`,
    )
  }
})

test('scores outside the range are clamped rather than throwing', () => {
  assert.equal(cefrForScore(-10), 'A1')
  assert.equal(cefrForScore(1000), 'C2')
  assert.equal(cefrForScore(Number.NaN), 'A1')
  assert.equal(cefrForScore(Number.POSITIVE_INFINITY), 'C2')
})

test('every band maps onto a level the teacher can speak at', () => {
  const levels = ['beginner', 'elementary', 'intermediate', 'upper-intermediate', 'advanced']
  for (const cefr of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
    assert.ok(levels.includes(CEFR_TO_LEVEL[cefr]), `${cefr} → ${CEFR_TO_LEVEL[cefr]}`)
  }
})

test('the mapping rises with the band', () => {
  const order = ['beginner', 'elementary', 'intermediate', 'upper-intermediate', 'advanced']
  const seen = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((c) => order.indexOf(CEFR_TO_LEVEL[c]))
  for (let i = 1; i < seen.length; i += 1) {
    assert.ok(seen[i] >= seen[i - 1], 'a higher CEFR band must never map to a lower level')
  }
})
