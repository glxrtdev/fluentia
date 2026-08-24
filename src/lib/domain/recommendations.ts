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
export async function recommendNext(userId: string): Promise<Recommendation | null> {
  /*
   * The rules below short-circuit, but asking for their inputs one at a time
   * meant five sequential round trips to a database on another continent.
   * Fetching all five at once costs one trip and the same rows.
   */
  const [profileRows, recent, worstRows, recentReports, studyingRows] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1),
    db
      .select({ topicId: conversations.topicId })
      .from(conversations)
      .where(and(eq(conversations.userId, userId), eq(conversations.status, 'completed')))
      .orderBy(desc(conversations.startedAt))
      .limit(4),
    db
      .select()
      .from(mistakes)
      .where(and(eq(mistakes.userId, userId), eq(mistakes.status, 'open')))
      .orderBy(desc(mistakes.occurrences), desc(mistakes.lastSeenAt))
      .limit(1),
    db
      .select({ speaking: sessionReports.speaking, vocabulary: sessionReports.vocabulary })
      .from(sessionReports)
      .where(eq(sessionReports.userId, userId))
      .orderBy(desc(sessionReports.createdAt))
      .limit(3),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(vocabulary)
      .where(and(eq(vocabulary.userId, userId), eq(vocabulary.status, 'learning'))),
  ])

  const profile = profileRows[0]
  if (!profile) return null

  const recentTopics = new Set(
    recent.map((row) => row.topicId).filter((value): value is string => Boolean(value)),
  )

  const pick = (topicId: string, reason: string, minutes = profile.dailyMinutesGoal) => {
    const topic = TOPIC_BY_ID.get(topicId)
    if (!topic) return null
    return { topicId, topicLabel: topic.label, reason, minutes }
  }

  // 1. A recurring mistake that keeps coming back is the most useful signal.
  const worst = worstRows[0]

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

  if (recentReports.length >= 2) {
    const average =
      recentReports.reduce((total, row) => total + row.speaking, 0) / recentReports.length
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
  const studying = studyingRows[0]

  if ((studying?.count ?? 0) >= 5) {
    const topic = TOPICS.find((candidate) => !recentTopics.has(candidate.id))
    if (topic) {
      return pick(
        topic.id,
        `You have ${studying.count} words waiting to be used. The teacher will slip them into this conversation.`,
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

/**
 * Simple counts the dashboard and profile pages both need. Every aggregate is
 * cast explicitly: Postgres returns count/sum as bigint, which arrives as a
 * string unless it is narrowed here.
 */
export async function learningSnapshot(userId: string) {
  const [wordRows, mistakeRows, scoreRows] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        learned: sql<number>`coalesce(sum(case when ${vocabulary.status} = 'learned' then 1 else 0 end), 0)::int`,
        learning: sql<number>`coalesce(sum(case when ${vocabulary.status} = 'learning' then 1 else 0 end), 0)::int`,
        review: sql<number>`coalesce(sum(case when ${vocabulary.status} = 'review' then 1 else 0 end), 0)::int`,
      })
      .from(vocabulary)
      .where(eq(vocabulary.userId, userId)),
    db
      .select({
        tracked: sql<number>`count(*)::int`,
        open: sql<number>`coalesce(sum(case when ${mistakes.status} = 'open' then 1 else 0 end), 0)::int`,
        resolved: sql<number>`coalesce(sum(case when ${mistakes.status} = 'resolved' then 1 else 0 end), 0)::int`,
        occurrences: sql<number>`coalesce(sum(${mistakes.occurrences}), 0)::int`,
      })
      .from(mistakes)
      .where(eq(mistakes.userId, userId)),
    db
      .select({
        speaking: sql<number | null>`round(avg(${sessionReports.speaking}))::int`,
        grammar: sql<number | null>`round(avg(${sessionReports.grammar}))::int`,
        vocabulary: sql<number | null>`round(avg(${sessionReports.vocabulary}))::int`,
        fluency: sql<number | null>`round(avg(${sessionReports.fluency}))::int`,
        sessions: sql<number>`count(*)::int`,
      })
      .from(sessionReports)
      .where(eq(sessionReports.userId, userId)),
  ])

  const words = wordRows[0]
  const mistakeCount = mistakeRows[0]
  const scores = scoreRows[0]

  return {
    words: {
      total: words?.total ?? 0,
      learned: words?.learned ?? 0,
      learning: words?.learning ?? 0,
      review: words?.review ?? 0,
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
export async function weeklyProgress(userId: string, weekStart: string) {
  const since = new Date(`${weekStart}T00:00:00`)

  const [sessionRows, wordRows, reviewedRows] = await Promise.all([
    db
      .select({
        sessions: sql<number>`coalesce(sum(case when ${conversations.status} = 'completed' then 1 else 0 end), 0)::int`,
        seconds: sql<number>`coalesce(sum(${conversations.durationSeconds}), 0)::int`,
      })
      .from(conversations)
      .where(and(eq(conversations.userId, userId), gte(conversations.startedAt, since))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(vocabulary)
      .where(and(eq(vocabulary.userId, userId), gte(vocabulary.createdAt, since))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(mistakes)
      .where(and(eq(mistakes.userId, userId), gte(mistakes.lastSeenAt, since))),
  ])

  return {
    weekly_sessions: sessionRows[0]?.sessions ?? 0,
    weekly_minutes: Math.round((sessionRows[0]?.seconds ?? 0) / 60),
    weekly_words: wordRows[0]?.count ?? 0,
    weekly_mistakes: reviewedRows[0]?.count ?? 0,
  }
}
