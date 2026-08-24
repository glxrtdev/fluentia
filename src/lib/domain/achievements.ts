import catalogue from './achievements.json'

/**
 * Achievement catalogue.
 *
 * The copy lives in `achievements.json` so the migration script can seed the
 * table without importing TypeScript — plain Node cannot load `.ts` files
 * before v23. The unlock rules stay here, keyed by id.
 */
export type AchievementStats = {
  conversationsCompleted: number
  totalPracticeSeconds: number
  wordsLearned: number
  streakCurrent: number
  resolvedMistakes: number
  bestSpeakingScore: number
  categoriesPracticed: string[]
  levelsPracticed: string[]
}

export type AchievementDef = {
  id: string
  title: string
  description: string
  icon: string
  xp: number
  test: (s: AchievementStats) => boolean
}

/** What each achievement demands of the learner's real numbers. */
const RULES: Record<string, (s: AchievementStats) => boolean> = {
  'first-conversation': (s) => s.conversationsCompleted >= 1,
  'ten-conversations': (s) => s.conversationsCompleted >= 10,
  'fifty-conversations': (s) => s.conversationsCompleted >= 50,
  'one-hour-speaking': (s) => s.totalPracticeSeconds >= 3600,
  'five-hours-speaking': (s) => s.totalPracticeSeconds >= 5 * 3600,
  'seven-day-streak': (s) => s.streakCurrent >= 7,
  'thirty-day-streak': (s) => s.streakCurrent >= 30,
  'hundred-words': (s) => s.wordsLearned >= 100,
  'first-career-session': (s) => s.categoriesPracticed.includes('career'),
  'first-advanced-session': (s) => s.levelsPracticed.includes('advanced'),
  'mistake-tamer': (s) => s.resolvedMistakes >= 1,
  'high-scorer': (s) => s.bestSpeakingScore >= 85,
}

export const ACHIEVEMENTS: AchievementDef[] = catalogue.map((entry) => {
  const test = RULES[entry.id]
  if (!test) throw new Error(`Achievement "${entry.id}" has no unlock rule.`)
  return { ...entry, test }
})

export const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]))
