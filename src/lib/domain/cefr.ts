import type { Level } from '@/lib/db/schema'

/**
 * The CEFR band a session's speaking score falls into.
 *
 * This used to be asked of the model, alongside the scores it had just given —
 * which meant a learner could score 42 and be told they were B2, because
 * nothing tied the two answers together. The band is now derived from the
 * score, so the report cannot contradict itself and the same score always
 * means the same level.
 *
 * Speaking is the score used: it is the headline number on the report, the one
 * the dashboard averages, and the only one judged from every turn rather than
 * from whatever evidence happened to appear.
 */
export const CEFR_BANDS = [
  { min: 90, cefr: 'C2' },
  { min: 75, cefr: 'C1' },
  { min: 60, cefr: 'B2' },
  { min: 45, cefr: 'B1' },
  { min: 30, cefr: 'A2' },
  { min: 0, cefr: 'A1' },
] as const

export type Cefr = (typeof CEFR_BANDS)[number]['cefr']

/**
 * Never throws. Out-of-range numbers clamp into the scale — an impossibly high
 * score is still a high score — while NaN, which carries no information at
 * all, falls to the bottom rather than pretending to.
 */
export function cefrForScore(score: number): Cefr {
  const value = Number.isNaN(score) ? 0 : Math.max(0, Math.min(100, score))
  return CEFR_BANDS.find((band) => value >= band.min)!.cefr
}

/** How a CEFR band maps onto the five levels the teacher speaks at. */
export const CEFR_TO_LEVEL: Record<Cefr, Level> = {
  A1: 'beginner',
  A2: 'elementary',
  B1: 'intermediate',
  B2: 'upper-intermediate',
  C1: 'advanced',
  C2: 'advanced',
}
