/**
 * Achievement catalogue. Each entry carries the rule that unlocks it, evaluated
 * against a snapshot of the user's real data after every session.
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

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-conversation',
    title: 'First Conversation',
    description: 'Complete your first speaking session',
    icon: 'sparkles',
    xp: 50,
    test: (s) => s.conversationsCompleted >= 1,
  },
  {
    id: 'ten-conversations',
    title: '10 Conversations',
    description: 'Complete ten speaking sessions',
    icon: 'messages',
    xp: 150,
    test: (s) => s.conversationsCompleted >= 10,
  },
  {
    id: 'fifty-conversations',
    title: '50 Conversations',
    description: 'Complete fifty speaking sessions',
    icon: 'trophy',
    xp: 500,
    test: (s) => s.conversationsCompleted >= 50,
  },
  {
    id: 'one-hour-speaking',
    title: '1 Hour Speaking',
    description: 'Reach one hour of total speaking practice',
    icon: 'clock',
    xp: 120,
    test: (s) => s.totalPracticeSeconds >= 3600,
  },
  {
    id: 'five-hours-speaking',
    title: '5 Hours Speaking',
    description: 'Reach five hours of total speaking practice',
    icon: 'clock',
    xp: 400,
    test: (s) => s.totalPracticeSeconds >= 5 * 3600,
  },
  {
    id: 'seven-day-streak',
    title: '7 Day Streak',
    description: 'Practise seven days in a row',
    icon: 'flame',
    xp: 200,
    test: (s) => s.streakCurrent >= 7,
  },
  {
    id: 'thirty-day-streak',
    title: '30 Day Streak',
    description: 'Practise thirty days in a row',
    icon: 'flame',
    xp: 800,
    test: (s) => s.streakCurrent >= 30,
  },
  {
    id: 'hundred-words',
    title: '100 Words Learned',
    description: 'Mark one hundred words as learned',
    icon: 'book',
    xp: 300,
    test: (s) => s.wordsLearned >= 100,
  },
  {
    id: 'first-career-session',
    title: 'First Career Session',
    description: 'Talk about your career in English',
    icon: 'briefcase',
    xp: 60,
    test: (s) => s.categoriesPracticed.includes('career'),
  },
  {
    id: 'first-advanced-session',
    title: 'First Advanced Session',
    description: 'Complete a conversation at advanced level',
    icon: 'mountain',
    xp: 180,
    test: (s) => s.levelsPracticed.includes('advanced'),
  },
  {
    id: 'mistake-tamer',
    title: 'Mistake Tamer',
    description: 'Fix a recurring mistake for good',
    icon: 'target',
    xp: 150,
    test: (s) => s.resolvedMistakes >= 1,
  },
  {
    id: 'high-scorer',
    title: 'High Scorer',
    description: 'Score 85 or more on speaking',
    icon: 'star',
    xp: 250,
    test: (s) => s.bestSpeakingScore >= 85,
  },
]

export const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]))
