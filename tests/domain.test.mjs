import { test } from 'node:test'
import assert from 'node:assert/strict'

const {
  addDays,
  clamp,
  dayFrom,
  daysBetween,
  formatClock,
  formatDuration,
  localDay,
  pct,
  startOfWeek,
} = await import('../src/lib/utils.ts')

test('localDay follows the learner timezone, not the server', () => {
  // 02:30 UTC is still the previous day in UTC-3.
  assert.equal(localDay(new Date('2026-03-01T02:30:00Z'), 180), '2026-02-28')
  // 23:30 UTC is already the next day in UTC+2.
  assert.equal(localDay(new Date('2026-03-01T23:30:00Z'), -120), '2026-03-02')
  assert.equal(localDay(new Date('2026-03-01T12:00:00Z'), 0), '2026-03-01')
})

test('dayFrom falls back to server time for junk input', () => {
  assert.match(dayFrom('not-a-number'), /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(dayFrom(0), localDay(new Date(), 0))
})

test('addDays crosses months, years and leap days', () => {
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
  assert.equal(addDays('2024-03-01', -1), '2024-02-29') // 2024 is a leap year
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2026-01-01', -1), '2025-12-31')
})

test('startOfWeek is Monday based', () => {
  assert.equal(startOfWeek('2026-08-21'), '2026-08-17') // Friday → Monday
  assert.equal(startOfWeek('2026-08-17'), '2026-08-17') // Monday → itself
  assert.equal(startOfWeek('2026-08-23'), '2026-08-17') // Sunday → same week
})

test('daysBetween counts calendar days', () => {
  assert.equal(daysBetween('2026-02-26', '2026-03-02'), 4)
  assert.equal(daysBetween('2026-03-02', '2026-02-26'), -4)
  assert.equal(daysBetween('2026-03-02', '2026-03-02'), 0)
})

/**
 * The streak is derived by walking backwards through recorded days. This mirrors
 * the loop in registerPractice, which is the part most likely to drift.
 */
function streakLength(recordedDays, today) {
  const recorded = new Set(recordedDays)
  let current = 0
  let cursor = today
  while (recorded.has(cursor)) {
    current += 1
    cursor = addDays(cursor, -1)
  }
  return current
}

test('streak counts consecutive days and stops at the first gap', () => {
  assert.equal(streakLength(['2026-08-21', '2026-08-20', '2026-08-19'], '2026-08-21'), 3)
  // A missing day breaks the run even if older days exist.
  assert.equal(streakLength(['2026-08-21', '2026-08-19', '2026-08-18'], '2026-08-21'), 1)
  // Practising only yesterday means today's streak is zero until they practise.
  assert.equal(streakLength(['2026-08-20'], '2026-08-21'), 0)
  assert.equal(streakLength([], '2026-08-21'), 0)
  // Runs that cross a month boundary stay intact.
  assert.equal(
    streakLength(['2026-03-01', '2026-02-28', '2026-02-27'], '2026-03-01'),
    3,
  )
})

test('formatting helpers read the way the UI needs', () => {
  assert.equal(formatDuration(0), '0m')
  assert.equal(formatDuration(45), '45s')
  assert.equal(formatDuration(16_320), '4h 32m')
  assert.equal(formatDuration(7200), '2h')
  assert.equal(formatClock(65), '1:05')
  assert.equal(formatClock(600), '10:00')
})

test('clamp and pct never produce impossible values', () => {
  assert.equal(clamp(120, 0, 100), 100)
  assert.equal(clamp(-5, 0, 100), 0)
  assert.equal(pct(7, 10), 70)
  assert.equal(pct(15, 10), 100)
  assert.equal(pct(1, 0), 0)
})
