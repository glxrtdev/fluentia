import { test } from 'node:test'
import assert from 'node:assert/strict'

const { advance, progressFor, bandFor, nextCefr, CONSISTENCY_TARGET } = await import(
  '../src/lib/domain/progression.ts'
)

const at = (cefr, progress = 0, streak = 0) => ({ cefr, progress, streak })

/* ------------------------------------------------------------------ bands */

test('the bands match the table exactly', () => {
  assert.deepEqual(bandFor('A1'), { min: 0, max: 29, cefr: 'A1' })
  assert.deepEqual(bandFor('A2'), { min: 30, max: 44, cefr: 'A2' })
  assert.deepEqual(bandFor('B1'), { min: 45, max: 59, cefr: 'B1' })
  assert.deepEqual(bandFor('B2'), { min: 60, max: 74, cefr: 'B2' })
  assert.deepEqual(bandFor('C1'), { min: 75, max: 89, cefr: 'C1' })
  assert.deepEqual(bandFor('C2'), { min: 90, max: 100, cefr: 'C2' })
})

test('C2 has nothing above it', () => {
  assert.equal(nextCefr('C2'), null)
  assert.equal(nextCefr('B1'), 'B2')
})

/* --------------------------------------------------------------- progress */

test('the worked example from the brief', () => {
  // B1 spans 45-59. Average of 51,54,55,57,58 is 55 → (55-45)/14 = 71%.
  assert.equal(progressFor('B1', [51, 54, 55, 57, 58]), 71)
})

test('fewer than five sessions average only what exists', () => {
  assert.equal(progressFor('B1', [52, 52]), progressFor('B1', [52]))
  assert.equal(progressFor('B1', [45]), 0)
})

test('no sessions is no evidence, not a guess', () => {
  assert.equal(progressFor('B1', []), 0)
})

test('progress never leaves 0-100', () => {
  assert.equal(progressFor('B1', [10, 12, 14]), 0)
  assert.equal(progressFor('B1', [90, 95, 99]), 100)
})

test('only the five most recent sessions count', () => {
  const six = [59, 59, 59, 59, 59, 0]
  assert.equal(progressFor('B1', six), 100, 'the sixth score must be ignored')
})

/* -------------------------------------------------------- climbing the bar */

test('a session below the ceiling just moves the bar', () => {
  const out = advance(at('B1'), 55, [55, 54, 51])
  assert.equal(out.cefr, 'B1')
  assert.equal(out.promotedTo, null)
  assert.equal(out.unlocking, false)
  assert.ok(out.progress > 0 && out.progress < 100)
})

test('a high score before the bar is full does not start the run', () => {
  // One strong session, but the average is still mid-band.
  const out = advance(at('B1', 40), 63, [63, 46, 46, 46, 46])
  assert.equal(out.streak, 0, 'the consistency run only starts at 100%')
  assert.equal(out.unlocking, false)
})

test('reaching the ceiling opens the consistency goal', () => {
  // The bar hits 100 only when the average reaches the top of the band, which
  // for B1 is 59 — not merely when the sessions are "close to the limit".
  const out = advance(at('B1', 93), 59, [59, 59, 59, 59, 59])
  assert.equal(out.progress, 100)
  assert.equal(out.target, 'B2')
  assert.equal(out.cefr, 'B1', 'the bar alone must not promote')
})

test('the bar follows the stated formula, not a feeling about it', () => {
  // 48,52,55,57,59 averages 54.2, which is 66% of the B1 span — not 100%.
  // Rounding this up to a full bar would promise a promotion run that has not
  // been earned.
  assert.equal(progressFor('B1', [59, 57, 55, 52, 48]), 66)
})

/* ------------------------------------------------------- the consistency run */

test('the full worked journey from the brief: B1 to B2', () => {
  let state = at('B1', 100)
  const scores = [63, 66, 61, 65, 68]
  const outcomes = []
  for (const [i, score] of scores.entries()) {
    const out = advance(state, score, scores.slice(0, i + 1).reverse())
    outcomes.push(out)
    state = { cefr: out.cefr, progress: out.progress, streak: out.streak }
  }

  assert.deepEqual(
    outcomes.slice(0, 4).map((o) => o.streak),
    [1, 2, 3, 4],
    'the run should count up one per session',
  )
  assert.equal(outcomes[4].promotedTo, 'B2', 'the fifth session promotes')
  assert.equal(state.cefr, 'B2')
  assert.equal(state.progress, 0, 'the new level starts empty')
  assert.equal(state.streak, 0, 'the run resets after a promotion')
  assert.equal(outcomes[4].target, 'C1', 'the next goal moves up')
})

test('a session outside the band breaks the run without losing the bar', () => {
  let state = at('B1', 100)
  for (const score of [63, 67, 61]) {
    const out = advance(state, score, [score])
    state = { cefr: out.cefr, progress: out.progress, streak: out.streak }
  }
  assert.equal(state.streak, 3)

  // 58 is B1, not B2 — the run fails.
  const failed = advance(state, 58, [58, 61, 67, 63])
  assert.equal(failed.streak, 0, 'the run resets')
  assert.equal(failed.cefr, 'B1', 'the level does not move')
  assert.equal(failed.progress, 100, 'the bar must not fall back below the ceiling')
})

test('a score two bands up still counts only for the next band', () => {
  // 80 is C1 while working towards B2: it is not "inside the next band".
  const out = advance(at('B1', 100, 3), 80, [80])
  assert.equal(out.streak, 0, 'skipping a band does not extend the run')
  assert.equal(out.cefr, 'B1')
})

test('the run must be consecutive, not cumulative', () => {
  let state = at('B1', 100)
  for (const score of [63, 67, 58, 64, 66, 62]) {
    const out = advance(state, score, [score])
    state = { cefr: out.cefr, progress: out.progress, streak: out.streak }
  }
  // 63,67 → 2, then 58 resets, then 64,66,62 → 3. Not yet five.
  assert.equal(state.cefr, 'B1')
  assert.equal(state.streak, 3)
})

test('promotion needs exactly the target number of sessions', () => {
  let state = at('B1', 100)
  let promoted = null
  for (let i = 0; i < CONSISTENCY_TARGET; i += 1) {
    const out = advance(state, 65, [65])
    state = { cefr: out.cefr, progress: out.progress, streak: out.streak }
    if (out.promotedTo) promoted = i + 1
  }
  assert.equal(promoted, CONSISTENCY_TARGET)
})

/* --------------------------------------------------------------- the ends */

test('C2 has no run to hold and no level to reach', () => {
  const out = advance(at('C2', 100), 95, [95, 92, 96])
  assert.equal(out.promotedTo, null)
  assert.equal(out.target, null)
  assert.equal(out.progress, 100)
  assert.equal(out.streak, 0)
})

test('a beginner climbs from A1 the same way', () => {
  const out = advance(at('A1', 100, 4), 35, [35])
  assert.equal(out.promotedTo, 'A2')
  assert.equal(out.target, 'B1')
})

test('XP is nowhere in this module', async () => {
  const source = await import('node:fs').then((fs) =>
    fs.readFileSync('src/lib/domain/progression.ts', 'utf8'),
  )
  assert.ok(!/\bxp\b/i.test(source.replace(/\/\*[\s\S]*?\*\//g, '')), 'XP must not affect levelling')
})
