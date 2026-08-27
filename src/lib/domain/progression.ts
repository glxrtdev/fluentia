// The explicit extension lets Node run this file directly in tests, where
// there is no bundler to resolve it.
import { CEFR_BANDS, cefrForScore, type Cefr } from './cefr.ts'

/**
 * How a learner moves between levels.
 *
 * Three things that used to be tangled are kept apart here:
 *
 *  - the **score** of a session measures one performance;
 *  - **progress** is how close recent performances sit to the top of the
 *    current level — a bar, not a promotion;
 *  - the **level** itself only moves when the learner has shown they can hold
 *    the next band repeatedly.
 *
 * XP is nowhere in this file, deliberately. It rewards showing up; it must
 * never be able to buy a level.
 *
 * Every function is pure so the rules can be tested directly — the awkward
 * cases (a failed streak, a promotion landing mid-session, a band with no
 * sessions yet) are exactly the ones that are painful to reproduce by hand.
 */

/** Ascending, so "the next one" is a simple index step. */
export const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

/** How many consecutive sessions inside the next band unlock it. */
export const CONSISTENCY_TARGET = 5

/** How many recent sessions the progress bar averages. */
export const PROGRESS_WINDOW = 5

/**
 * A session only counts towards levelling if it produced enough speech to
 * judge. Four turns is the same bar the old auto-adapt used: below it a score
 * says more about the length of the conversation than about the learner.
 */
export const MIN_TURNS_TO_COUNT = 4

export const bandFor = (cefr: string) => {
  const band = CEFR_BANDS.find((entry) => entry.cefr === cefr)
  if (!band) return { min: 0, max: 29, cefr: 'A1' as Cefr }
  const index = CEFR_BANDS.findIndex((entry) => entry.cefr === cefr)
  // CEFR_BANDS runs high to low; the band above sets this one's ceiling.
  const above = CEFR_BANDS[index - 1]
  return { min: band.min, max: above ? above.min - 1 : 100, cefr: band.cefr }
}

/** The band a learner is working towards, or null at the top of the scale. */
export function nextCefr(current: string): Cefr | null {
  const index = CEFR_ORDER.indexOf(current as Cefr)
  if (index < 0) return CEFR_ORDER[1]
  return index >= CEFR_ORDER.length - 1 ? null : CEFR_ORDER[index + 1]
}

/**
 * How far recent performance sits between the floor and the ceiling of the
 * current level, as a whole percentage.
 *
 * Uses however many sessions exist, up to the window — a learner with two
 * sessions gets an honest average of two, not a number padded with invented
 * values. No sessions means no evidence, which is 0.
 */
export function progressFor(currentCefr: string, recentScores: number[]): number {
  const scores = recentScores.slice(0, PROGRESS_WINDOW)
  if (scores.length === 0) return 0

  const band = bandFor(currentCefr)
  const span = band.max - band.min
  if (span <= 0) return 100

  const average = scores.reduce((total, score) => total + score, 0) / scores.length
  const ratio = ((average - band.min) / span) * 100
  return Math.max(0, Math.min(100, Math.round(ratio)))
}

export type ProgressionState = {
  /** The level the learner actually holds. */
  cefr: string
  /** 0-100, and a ratchet at the top: see `advance`. */
  progress: number
  /** Consecutive sessions scored inside the next band. */
  streak: number
}

export type ProgressionOutcome = ProgressionState & {
  /** The band this session belongs to, for the report. */
  sessionCefr: Cefr
  /** Set only when this very session earned the promotion. */
  promotedTo: Cefr | null
  /** True once the bar is full and the consistency run is what remains. */
  unlocking: boolean
  /** What the learner is working towards, or null at C2. */
  target: Cefr | null
}

/**
 * Folds one finished session into a learner's progression.
 *
 * `recentScores` are the scores earned *at the current level*, newest first,
 * including this session. Scoping them to the current level is what makes a
 * fresh level start at 0% rather than inheriting the average that earned the
 * promotion.
 */
export function advance(
  state: ProgressionState,
  sessionScore: number,
  recentScores: number[],
): ProgressionOutcome {
  const sessionCefr = cefrForScore(sessionScore)
  const target = nextCefr(state.cefr)

  const computed = progressFor(state.cefr, recentScores)
  /*
   * A ratchet, but only at the ceiling. Reaching 100% is a claim the learner
   * has already proved, so a later dip — or a broken consistency run — must
   * not take it away. Below the ceiling the bar simply follows the average.
   */
  const progress = state.progress >= 100 ? 100 : computed

  // Nothing to unlock at the top of the scale, and nothing to count.
  if (!target) {
    return { cefr: state.cefr, progress: 100, streak: 0, sessionCefr, promotedTo: null, unlocking: false, target: null }
  }

  if (progress < 100) {
    // Still climbing. A stray high score does not start the run early.
    return { cefr: state.cefr, progress, streak: 0, sessionCefr, promotedTo: null, unlocking: false, target }
  }

  const inTargetBand = sessionCefr === target
  const streak = inTargetBand ? state.streak + 1 : 0

  if (streak >= CONSISTENCY_TARGET) {
    /*
     * Promoted by this session, not by the next page load. The new level
     * starts empty: its progress will be built from sessions that come after.
     */
    return {
      cefr: target,
      progress: 0,
      streak: 0,
      sessionCefr,
      promotedTo: target,
      unlocking: false,
      target: nextCefr(target),
    }
  }

  return { cefr: state.cefr, progress: 100, streak, sessionCefr, promotedTo: null, unlocking: true, target }
}

/** The five teaching levels, so the teacher speaks at the learner's band. */
export const CEFR_TO_TEACHING_LEVEL = {
  A1: 'beginner',
  A2: 'elementary',
  B1: 'intermediate',
  B2: 'upper-intermediate',
  C1: 'advanced',
  C2: 'advanced',
} as const
