import 'server-only'

import { and, desc, eq, gte, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { conversations, mistakes, profiles, sessionReports, vocabulary } from '@/lib/db/schema'
import { TOPIC_BY_ID, TOPICS } from '@/lib/domain/topics'
import { CATEGORY_LABELS } from '@/lib/utils'

export type Recommendation = {
  topicId: string
  topicLabel: string
  reason: string
  minutes: number
}

/** Topics that naturally force a given kind of language out of the learner. */
const CATEGORY_TO_TOPIC: Record<string, string> = {
  grammar: 'weekend',
  prepositions: 'directions',
  vocabulary: 'ai',
  'sentence-structure': 'meetings',
  naturalness: 'friends',
  pronunciation: 'daily-routine',
}

const GOAL_TO_TOPIC: Record<string, string> = {
  career: 'my-career',
  interviews: 'job-interview',
  travel: 'airport',
  studies: 'university',
  'daily-conversation': 'daily-routine',
  fluency: 'hobbies',
}

const PAST_TENSE_HINTS = /\b(went|was|were|did|had|yesterday|last week|past tense)\b/i

/**
 * Turns the learner's own history into a next step. Everything here reads real
 * rows — there is no placeholder path.
 */
export function recommendNext(userId: string): Recommendation | null {
  const profile = db.select().from(profiles).where(eq(profiles.userId, userId)).get()
  if (!profile) return null

  const recentTopics = new Set(
    db
      .select({ topicId: conversations.topicId })
      .from(conversations)
      .where(and(eq(conversations.userId, userId), eq(conversations.status, 'completed')))
      .orderBy(desc(conversations.startedAt))
      .limit(4)
      .all()
      .map((row) => row.topicId)
      .filter((value): value is string => Boolean(value)),
  )

  const pick = (topicId: string, reason: string, minutes = profile.dailyMinutesGoal) => {
    const topic = TOPIC_BY_ID.get(topicId)
    if (!topic) return null
    return { topicId, topicLabel: topic.label, reason, minutes }
  }

  // 1. A recurring mistake that keeps coming back is the most useful signal.
  const worst = db
    .select()
    .from(mistakes)
    .where(and(eq(mistakes.userId, userId), eq(mistakes.status, 'open')))
    .orderBy(desc(mistakes.occurrences), desc(mistakes.lastSeenAt))
    .limit(1)
    .get()

  if (worst && worst.occurrences >= 2) {
    const isPast = PAST_TENSE_HINTS.test(`${worst.corrected} ${worst.explanation ?? ''}`)
    const topicId = isPast ? 'weekend' : (CATEGORY_TO_TOPIC[worst.category] ?? 'hobbies')
    if (!recentTopics.has(topicId)) {
      const label = isPast
        ? 'past tense'
        : (CATEGORY_LABELS[worst.category]?.toLowerCase() ?? worst.category)
      return pick(
        topicId,
        `You have slipped on ${label} ${worst.occurrences} times — "${worst.original}" should be "${worst.corrected}". This topic pulls that form out of you naturally.`,
      )
    }
  }

  // 2. Strong recent scores earn a harder conversation.
  const recent = db
    .select({ speaking: sessionReports.speaking, vocabulary: sessionReports.vocabulary })
    .from(sessionReports)
    .where(eq(sessionReports.userId, userId))
    .orderBy(desc(sessionReports.createdAt))
    .limit(3)
    .all()

  if (recent.length >= 2) {
    const average = recent.reduce((total, row) => total + row.speaking, 0) / recent.length
    if (average >= 80) {
      const harder = ['negotiation', 'leadership', 'future-technology', 'entrepreneurship'].find(
        (topicId) => !recentTopics.has(topicId),
      )
      if (harder) {
        return pick(
          harder,
          `Your last sessions averaged ${Math.round(average)} on speaking. Time for something that pushes back.`,
        )
      }
    }
  }

  // 3. Nudge towards the goal they signed up for.
  if (profile.mainGoal) {
    const goalTopic = GOAL_TO_TOPIC[profile.mainGoal]
    if (goalTopic && !recentTopics.has(goalTopic)) {
      return pick(
        goalTopic,
        `Your main goal is ${profile.mainGoal.replace('-', ' ')}. This is the conversation that gets you closer to it.`,
      )
    }
  }

  // 4. Reuse the words they are studying.
  const studying = db
    .select({ count: sql<number>`count(*)` })
    .from(vocabulary)
    .where(and(eq(vocabulary.userId, userId), eq(vocabulary.status, 'learning')))
    .get()

  if ((studying?.count ?? 0) >= 5) {
    const topic = TOPICS.find((candidate) => !recentTopics.has(candidate.id))
    if (topic) {
      return pick(
        topic.id,
        `You have ${studying?.count} words waiting to be used. The teacher will slip them into this conversation.`,
      )
    }
  }

  // 5. First-timer.
  const topic = TOPICS.find((candidate) => !recentTopics.has(candidate.id)) ?? TOPICS[0]
  return pick(
    topic.id,
    'A relaxed first conversation is the fastest way to get a real reading of your level.',
  )
}

/** Simple counts the dashboard and profile pages both need. */
export function learningSnapshot(userId: string) {
  const wordCount = db
    .select({
      total: sql<number>`count(*)`,
      learned: sql<number>`sum(case when ${vocabulary.status} = 'learned' then 1 else 0 end)`,
      learning: sql<number>`sum(case when ${vocabulary.status} = 'learning' then 1 else 0 end)`,
      review: sql<number>`sum(case when ${vocabulary.status} = 'review' then 1 else 0 end)`,
    })
    .from(vocabulary)
    .where(eq(vocabulary.userId, userId))
    .get()

  const mistakeCount = db
    .select({
      tracked: sql<number>`count(*)`,
      open: sql<number>`sum(case when ${mistakes.status} = 'open' then 1 else 0 end)`,
      resolved: sql<number>`sum(case when ${mistakes.status} = 'resolved' then 1 else 0 end)`,
      occurrences: sql<number>`coalesce(sum(${mistakes.occurrences}), 0)`,
    })
    .from(mistakes)
    .where(eq(mistakes.userId, userId))
    .get()

  const scores = db
    .select({
      speaking: sql<number>`round(avg(${sessionReports.speaking}))`,
      grammar: sql<number>`round(avg(${sessionReports.grammar}))`,
      vocabulary: sql<number>`round(avg(${sessionReports.vocabulary}))`,
      fluency: sql<number>`round(avg(${sessionReports.fluency}))`,
      sessions: sql<number>`count(*)`,
    })
    .from(sessionReports)
    .where(eq(sessionReports.userId, userId))
    .get()

  return {
    words: {
      total: wordCount?.total ?? 0,
      learned: wordCount?.learned ?? 0,
      learning: wordCount?.learning ?? 0,
      review: wordCount?.review ?? 0,
    },
    mistakes: {
      tracked: mistakeCount?.tracked ?? 0,
      open: mistakeCount?.open ?? 0,
      resolved: mistakeCount?.resolved ?? 0,
      occurrences: mistakeCount?.occurrences ?? 0,
    },
    scores: {
      speaking: scores?.speaking ?? null,
      grammar: scores?.grammar ?? null,
      vocabulary: scores?.vocabulary ?? null,
      fluency: scores?.fluency ?? null,
      sessions: scores?.sessions ?? 0,
    },
  }
}

/** Weekly goal progress computed from practice rows, never stored twice. */
export function weeklyProgress(userId: string, weekStart: string) {
  const sessions = db
    .select({
      sessions: sql<number>`coalesce(sum(case when ${conversations.status} = 'completed' then 1 else 0 end), 0)`,
      seconds: sql<number>`coalesce(sum(${conversations.durationSeconds}), 0)`,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        gte(conversations.startedAt, new Date(`${weekStart}T00:00:00`)),
      ),
    )
    .get()

  const words = db
    .select({ count: sql<number>`count(*)` })
    .from(vocabulary)
    .where(
      and(eq(vocabulary.userId, userId), gte(vocabulary.createdAt, new Date(`${weekStart}T00:00:00`))),
    )
    .get()

  const reviewed = db
    .select({ count: sql<number>`count(*)` })
    .from(mistakes)
    .where(
      and(
        eq(mistakes.userId, userId),
        gte(mistakes.lastSeenAt, new Date(`${weekStart}T00:00:00`)),
      ),
    )
    .get()

  return {
    weekly_sessions: sessions?.sessions ?? 0,
    weekly_minutes: Math.round((sessions?.seconds ?? 0) / 60),
    weekly_words: words?.count ?? 0,
    weekly_mistakes: reviewed?.count ?? 0,
  }
}
