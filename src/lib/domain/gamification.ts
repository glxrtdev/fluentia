import 'server-only'

import { and, desc, eq, gte, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  achievements,
  conversations,
  mistakes,
  practiceSessions,
  profiles,
  sessionReports,
  streaks,
  userAchievements,
  vocabulary,
} from '@/lib/db/schema'
import { ACHIEVEMENTS, type AchievementStats } from '@/lib/domain/achievements'
import { addDays, localDay } from '@/lib/utils'

export const XP = {
  startSession: 10,
  completeSession: 40,
  perMinuteSpoken: 4,
  perCorrectionReviewed: 5,
  wordLearned: 8,
  mistakeResolved: 25,
  goalReached: 60,
} as const

type PracticeInput = {
  userId: string
  kind: 'conversation' | 'vocabulary' | 'review'
  seconds?: number
  xp: number
  conversationId?: string | null
  score?: number | null
  day: string
  /** Only completed conversations count towards weekly session goals. */
  countsAsSession?: boolean
}

/**
 * The single entry point for progress: logs the activity, updates the day's
 * streak row, recomputes the streak and adds XP. Everything runs in one
 * transaction so a failure never leaves half-credited progress.
 */
export function registerPractice(input: PracticeInput) {
  const { userId, day } = input
  const seconds = Math.max(0, Math.round(input.seconds ?? 0))
  const sessionDelta = input.countsAsSession ? 1 : 0

  return db.transaction(async (tx) => {
    await tx.insert(practiceSessions).values({
      userId,
      conversationId: input.conversationId ?? null,
      kind: input.kind,
      seconds,
      xpEarned: input.xp,
      score: input.score ?? null,
    })

    await tx
      .insert(streaks)
      .values({ userId, day, seconds, sessions: sessionDelta, xp: input.xp })
      .onConflictDoUpdate({
        target: [streaks.userId, streaks.day],
        set: {
          seconds: sql`${streaks.seconds} + ${seconds}`,
          sessions: sql`${streaks.sessions} + ${sessionDelta}`,
          xp: sql`${streaks.xp} + ${input.xp}`,
        },
      })

    // Walk back from today through the recorded days to find the run length.
    const days = await tx
      .select({ day: streaks.day })
      .from(streaks)
      .where(eq(streaks.userId, userId))
      .orderBy(desc(streaks.day))
      .limit(400)

    const recorded = new Set(days.map((row) => row.day))
    let current = 0
    let cursor = day
    while (recorded.has(cursor)) {
      current += 1
      cursor = addDays(cursor, -1)
    }

    const [profile] = await tx.select().from(profiles).where(eq(profiles.userId, userId)).limit(1)
    const longest = Math.max(current, profile?.streakLongest ?? 0)

    await tx
      .update(profiles)
      .set({
        xp: sql`${profiles.xp} + ${input.xp}`,
        totalPracticeSeconds: sql`${profiles.totalPracticeSeconds} + ${seconds}`,
        streakCurrent: current,
        streakLongest: longest,
        lastPracticeDate: day,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, userId))

    return { streakCurrent: current, streakLongest: longest, xpAwarded: input.xp }
  })
}

/** Adds XP without touching the streak (vocabulary saves, mistake reviews). */
export async function addXp(userId: string, amount: number, day = localDay()) {
  if (amount <= 0) return

  await db
    .update(profiles)
    .set({ xp: sql`${profiles.xp} + ${amount}`, updatedAt: new Date() })
    .where(eq(profiles.userId, userId))

  await db
    .insert(streaks)
    .values({ userId, day, seconds: 0, sessions: 0, xp: amount })
    .onConflictDoUpdate({
      target: [streaks.userId, streaks.day],
      set: { xp: sql`${streaks.xp} + ${amount}` },
    })
}

async function statsFor(userId: string): Promise<AchievementStats> {
  const [profileRow, completedRow, wordsRow, resolvedRow, bestRow, practised] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversations)
      .where(and(eq(conversations.userId, userId), eq(conversations.status, 'completed'))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(vocabulary)
      .where(and(eq(vocabulary.userId, userId), eq(vocabulary.status, 'learned'))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(mistakes)
      .where(and(eq(mistakes.userId, userId), eq(mistakes.status, 'resolved'))),
    db
      .select({ best: sql<number>`coalesce(max(${sessionReports.speaking}), 0)::int` })
      .from(sessionReports)
      .where(eq(sessionReports.userId, userId)),
    db
      .selectDistinct({ category: conversations.category, level: conversations.level })
      .from(conversations)
      .where(and(eq(conversations.userId, userId), eq(conversations.status, 'completed'))),
  ])

  return {
    conversationsCompleted: completedRow[0]?.count ?? 0,
    totalPracticeSeconds: profileRow[0]?.totalPracticeSeconds ?? 0,
    wordsLearned: wordsRow[0]?.count ?? 0,
    streakCurrent: profileRow[0]?.streakCurrent ?? 0,
    resolvedMistakes: resolvedRow[0]?.count ?? 0,
    bestSpeakingScore: bestRow[0]?.best ?? 0,
    categoriesPracticed: practised.map((row) => row.category),
    levelsPracticed: practised.map((row) => row.level),
  }
}

export type UnlockedAchievement = { id: string; title: string; description: string; xp: number }

/** Evaluates the catalogue against real data and unlocks whatever now qualifies. */
export async function syncAchievements(userId: string): Promise<UnlockedAchievement[]> {
  const stats = await statsFor(userId)
  const ownedRows = await db
    .select({ id: userAchievements.achievementId })
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId))

  const owned = new Set(ownedRows.map((row) => row.id))
  const unlocked: UnlockedAchievement[] = []

  for (const achievement of ACHIEVEMENTS) {
    if (owned.has(achievement.id) || !achievement.test(stats)) continue

    await db
      .insert(userAchievements)
      .values({ userId, achievementId: achievement.id })
      .onConflictDoNothing()

    if (achievement.xp > 0) await addXp(userId, achievement.xp)

    unlocked.push({
      id: achievement.id,
      title: achievement.title,
      description: achievement.description,
      xp: achievement.xp,
    })
  }

  return unlocked
}

export async function listAchievements(userId: string) {
  const [ownedRows, catalogue] = await Promise.all([
    db
      .select({ id: userAchievements.achievementId, unlockedAt: userAchievements.unlockedAt })
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId)),
    db.select().from(achievements).orderBy(achievements.sortOrder),
  ])

  const owned = new Map(ownedRows.map((row) => [row.id, row.unlockedAt]))

  return catalogue.map((achievement) => ({
    ...achievement,
    unlockedAt: owned.get(achievement.id) ?? null,
  }))
}

/** Per-day practice for the last `days` days, oldest first — powers the streak strip. */
export async function activityCalendar(userId: string, days = 28, today = localDay()) {
  const from = addDays(today, -(days - 1))
  const recorded = await db
    .select({ day: streaks.day, seconds: streaks.seconds, sessions: streaks.sessions })
    .from(streaks)
    .where(and(eq(streaks.userId, userId), gte(streaks.day, from)))

  const rows = new Map(recorded.map((row) => [row.day, row]))

  return Array.from({ length: days }, (_, i) => {
    const day = addDays(from, i)
    const row = rows.get(day)
    return { day, seconds: row?.seconds ?? 0, sessions: row?.sessions ?? 0 }
  })
}
