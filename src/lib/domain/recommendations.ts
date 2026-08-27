import 'server-only'

import { and, desc, eq, gte, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { conversations, mistakes, sessionReports, vocabulary, workspaces } from '@/lib/db/schema'
import { TOPIC_BY_ID, TOPICS } from '@/lib/domain/topics'
import { CATEGORY_LABELS } from '@/lib/utils'

export type Recommendation = {
  topicId: string
  topicLabel: string
  reason: string
  minutes: number
}

/** The goals a learner picks at onboarding, written the way the app says them. */
const GOAL_LABELS: Record<string, string> = {
  travel: 'viagem',
  career: 'carreira',
  studies: 'estudos',
  interviews: 'entrevistas',
  'daily-conversation': 'conversa do dia a dia',
  fluency: 'fluência',
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
export async function recommendNext(workspaceId: string): Promise<Recommendation | null> {
  /*
   * The rules below short-circuit, but asking for their inputs one at a time
   * meant five sequential round trips to a database on another continent.
   * Fetching all five at once costs one trip and the same rows.
   */
  const [workspaceRows, recent, worstRows, recentReports, studyingRows] = await Promise.all([
    db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1),
    db
      .select({ topicId: conversations.topicId })
      .from(conversations)
      .where(and(eq(conversations.workspaceId, workspaceId), eq(conversations.status, 'completed')))
      .orderBy(desc(conversations.startedAt))
      .limit(4),
    db
      .select()
      .from(mistakes)
      .where(and(eq(mistakes.workspaceId, workspaceId), eq(mistakes.status, 'open')))
      .orderBy(desc(mistakes.occurrences), desc(mistakes.lastSeenAt))
      .limit(1),
    db
      .select({ speaking: sessionReports.speaking, vocabulary: sessionReports.vocabulary })
      .from(sessionReports)
      .where(eq(sessionReports.workspaceId, workspaceId))
      .orderBy(desc(sessionReports.createdAt))
      .limit(3),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(vocabulary)
      .where(and(eq(vocabulary.workspaceId, workspaceId), eq(vocabulary.status, 'learning'))),
  ])

  const workspace = workspaceRows[0]
  if (!workspace) return null

  const recentTopics = new Set(
    recent.map((row) => row.topicId).filter((value): value is string => Boolean(value)),
  )

  const pick = (topicId: string, reason: string, minutes = workspace.dailyMinutesGoal) => {
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
        `Você escorregou em ${label} ${worst.occurrences} vezes — "${worst.original}" deveria ser "${worst.corrected}". Este tema puxa essa forma de você naturalmente.`,
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
          `Suas últimas sessões tiveram média ${Math.round(average)} em fala. Hora de algo que ofereça resistência.`,
        )
      }
    }
  }

  // 3. Nudge towards the goal they signed up for.
  if (workspace.mainGoal) {
    const goalTopic = GOAL_TO_TOPIC[workspace.mainGoal]
    if (goalTopic && !recentTopics.has(goalTopic)) {
      return pick(
        goalTopic,
        `Seu objetivo principal é ${GOAL_LABELS[workspace.mainGoal] ?? workspace.mainGoal}. Esta é a conversa que te aproxima dele.`,
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
        `Você tem ${studying.count} palavras esperando para serem usadas. O professor vai encaixá-las nesta conversa.`,
      )
    }
  }

  // 5. First-timer.
  const topic = TOPICS.find((candidate) => !recentTopics.has(candidate.id)) ?? TOPICS[0]
  return pick(
    topic.id,
    'Uma primeira conversa tranquila é o jeito mais rápido de medir seu nível de verdade.',
  )
}

/**
 * Simple counts the dashboard and profile pages both need. Every aggregate is
 * cast explicitly: Postgres returns count/sum as bigint, which arrives as a
 * string unless it is narrowed here.
 */
export async function learningSnapshot(workspaceId: string) {
  const [wordRows, mistakeRows, scoreRows] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        learned: sql<number>`coalesce(sum(case when ${vocabulary.status} = 'learned' then 1 else 0 end), 0)::int`,
        learning: sql<number>`coalesce(sum(case when ${vocabulary.status} = 'learning' then 1 else 0 end), 0)::int`,
        review: sql<number>`coalesce(sum(case when ${vocabulary.status} = 'review' then 1 else 0 end), 0)::int`,
      })
      .from(vocabulary)
      .where(eq(vocabulary.workspaceId, workspaceId)),
    db
      .select({
        tracked: sql<number>`count(*)::int`,
        open: sql<number>`coalesce(sum(case when ${mistakes.status} = 'open' then 1 else 0 end), 0)::int`,
        resolved: sql<number>`coalesce(sum(case when ${mistakes.status} = 'resolved' then 1 else 0 end), 0)::int`,
        occurrences: sql<number>`coalesce(sum(${mistakes.occurrences}), 0)::int`,
      })
      .from(mistakes)
      .where(eq(mistakes.workspaceId, workspaceId)),
    db
      .select({
        speaking: sql<number | null>`round(avg(${sessionReports.speaking}))::int`,
        grammar: sql<number | null>`round(avg(${sessionReports.grammar}))::int`,
        vocabulary: sql<number | null>`round(avg(${sessionReports.vocabulary}))::int`,
        fluency: sql<number | null>`round(avg(${sessionReports.fluency}))::int`,
        sessions: sql<number>`count(*)::int`,
      })
      .from(sessionReports)
      .where(eq(sessionReports.workspaceId, workspaceId)),
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
export async function weeklyProgress(workspaceId: string, weekStart: string) {
  const since = new Date(`${weekStart}T00:00:00`)

  const [sessionRows, wordRows, reviewedRows] = await Promise.all([
    db
      .select({
        sessions: sql<number>`coalesce(sum(case when ${conversations.status} = 'completed' then 1 else 0 end), 0)::int`,
        seconds: sql<number>`coalesce(sum(${conversations.durationSeconds}), 0)::int`,
      })
      .from(conversations)
      .where(and(eq(conversations.workspaceId, workspaceId), gte(conversations.startedAt, since))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(vocabulary)
      .where(and(eq(vocabulary.workspaceId, workspaceId), gte(vocabulary.createdAt, since))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(mistakes)
      .where(and(eq(mistakes.workspaceId, workspaceId), gte(mistakes.lastSeenAt, since))),
  ])

  return {
    weekly_sessions: sessionRows[0]?.sessions ?? 0,
    weekly_minutes: Math.round((sessionRows[0]?.seconds ?? 0) / 60),
    weekly_words: wordRows[0]?.count ?? 0,
    weekly_mistakes: reviewedRows[0]?.count ?? 0,
  }
}
