import 'server-only'

import { and, desc, eq, gte } from 'drizzle-orm'

import { db } from '@/lib/db'
import { conversations, sessionReports, workspaces } from '@/lib/db/schema'
import { conversationCorrections, conversationTranscript } from '@/lib/domain/conversation'
import {
  registerPractice,
  syncAchievements,
  XP,
  type UnlockedAchievement,
} from '@/lib/domain/gamification'
import { AiError, type AiClient } from '@/lib/ai'
import { buildReportPrompt, REPORT_SCHEMA } from '@/lib/openai/prompts'
import { cefrForScore } from '@/lib/domain/cefr'
import {
  advance,
  CEFR_TO_TEACHING_LEVEL,
  MIN_TURNS_TO_COUNT,
  PROGRESS_WINDOW,
} from '@/lib/domain/progression'
import { clamp } from '@/lib/utils'

type RawReport = Record<string, unknown>

const score = (value: unknown, fallback: number) =>
  clamp(Math.round(Number(value) || fallback), 0, 100)

const stringList = (value: unknown, max: number) =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).slice(0, max)
    : []

function pairList<K extends string, V extends string>(
  value: unknown,
  keyName: K,
  valueName: V,
  max: number,
) {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => entry as Record<string, unknown>)
    .filter((entry) => typeof entry?.[keyName] === 'string' && String(entry[keyName]).trim())
    .slice(0, max)
    .map(
      (entry) =>
        ({
          [keyName]: String(entry[keyName]).trim().slice(0, 120),
          [valueName]: String(entry[valueName] ?? '').trim().slice(0, 300),
        }) as Record<K | V, string>,
    )
}

/**
 * Closes a session: asks the model to assess the transcript, stores the report,
 * updates the learning profile, awards XP and unlocks achievements.
 */
export async function finishConversation(args: {
  ai: AiClient
  userId: string
  learnerName: string
  conversationId: string
  durationSeconds: number
  day: string
}) {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, args.conversationId))
    .limit(1)

  if (!conversation || conversation.userId !== args.userId) {
    throw new AiError('Conversation not found.', 404)
  }

  const [existing] = await db
    .select({ id: sessionReports.id })
    .from(sessionReports)
    .where(eq(sessionReports.conversationId, conversation.id))
    .limit(1)
  if (existing) return { reportId: existing.id, unlocked: [] as UnlockedAchievement[] }

  const [transcript, corrections] = await Promise.all([
    conversationTranscript(conversation.id),
    conversationCorrections(conversation.id),
  ])
  const userTurns = transcript.filter((message) => message.role === 'user')

  if (userTurns.length === 0) {
    throw new AiError('Ainda não há o que relatar — fale alguma coisa primeiro.', 400)
  }

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, conversation.workspaceId))
    .limit(1)
  if (!workspace) throw new AiError('Essa conversa não tem espaço de idioma.', 404)

  const wordsSpoken = userTurns.reduce(
    (total, message) => total + message.content.split(/\s+/).filter(Boolean).length,
    0,
  )

  const dialogue = transcript
    .map((message) => `${message.role === 'user' ? 'LEARNER' : 'TEACHER'}: ${message.content}`)
    .join('\n')

  const liveCorrections = corrections
    .map((correction) => `- [${correction.category}] "${correction.original}" → "${correction.corrected}"`)
    .join('\n')

  const raw = (await args.ai.chatJson({
    system: buildReportPrompt({
      language: workspace.language,
      learnerName: args.learnerName,
      level: conversation.level,
      topicLabel: conversation.topicLabel,
      durationSeconds: args.durationSeconds,
      correctionCount: corrections.length,
    }),
    messages: [
      {
        role: 'user',
        content: `TRANSCRIPT
${dialogue}

CORRECTIONS RAISED LIVE
${
          liveCorrections || '(none)'
        }`,
      },
    ],
    schema: REPORT_SCHEMA as unknown as Record<string, unknown>,
    schemaName: 'session_report',
    temperature: 0.3,
    maxTokens: 1200,
  })) as RawReport

  const baseline = 60
  const speaking = score(raw.speaking, baseline)
  const pronunciationRaw = raw.pronunciation
  /*
   * Derived from the score rather than asked for. The model used to answer
   * both separately, so a session could score 42 and still be labelled B2.
   */
  const estimatedCefr = cefrForScore(speaking)

  /*
   * A short exchange scores something, but that score describes the length of
   * the conversation more than the learner. Only sessions with real evidence
   * move the level; the rest still get a report and still earn XP.
   */
  const countsTowardsLevel = userTurns.length >= MIN_TURNS_TO_COUNT

  /*
   * The window is scoped to the current level, not to all time: a promotion
   * restarts it, which is what makes a fresh band open at 0% instead of
   * inheriting the average that earned it.
   */
  const previous = countsTowardsLevel
    ? await db
        .select({ speaking: sessionReports.speaking })
        .from(sessionReports)
        .where(
          and(
            eq(sessionReports.workspaceId, conversation.workspaceId),
            eq(sessionReports.countsTowardsLevel, true),
            gte(sessionReports.createdAt, workspace.levelAchievedAt),
          ),
        )
        .orderBy(desc(sessionReports.createdAt))
        .limit(PROGRESS_WINDOW - 1)
    : []

  const state = {
    cefr: workspace.officialCefr,
    progress: workspace.levelProgress,
    streak: workspace.consistencyStreak,
  }
  const outcome = countsTowardsLevel
    ? advance(state, speaking, [speaking, ...previous.map((row) => row.speaking)])
    : { ...state, sessionCefr: estimatedCefr, promotedTo: null, unlocking: false, target: null }

  const [report] = await db
    .insert(sessionReports)
    .values({
      conversationId: conversation.id,
      userId: args.userId,
      workspaceId: conversation.workspaceId,
      speaking,
      grammar: score(raw.grammar, speaking),
      vocabulary: score(raw.vocabulary, speaking),
      fluency: score(raw.fluency, speaking),
      pronunciation:
        pronunciationRaw === null || pronunciationRaw === undefined
          ? null
          : score(pronunciationRaw, speaking),
      estimatedLevel: estimatedCefr,
      countsTowardsLevel: countsTowardsLevel,
      promotedTo: outcome.promotedTo,
      summary: String(raw.summary ?? '').trim().slice(0, 1200) || 'Sessão concluída.',
      mainMistakes: pairList(raw.main_mistakes, 'label', 'detail', 4),
      newWords: pairList(raw.new_words, 'word', 'meaning', 6),
      expressions: pairList(raw.expressions, 'expression', 'meaning', 6),
      recommendations: stringList(raw.recommendations, 3),
      wordsSpoken,
    })
    .returning({ id: sessionReports.id })

  await db.update(conversations)
    .set({
      status: 'completed',
      endedAt: new Date(),
      durationSeconds: Math.max(0, Math.round(args.durationSeconds)),
    })
    .where(eq(conversations.id, conversation.id))

  // The workspace is the memory the next conversation in this language reads from.
  const strengths = stringList(raw.strengths, 3)
  const weaknesses = stringList(raw.weaknesses, 3)

  await db.update(workspaces)
    .set({
      estimatedCefr,
      officialCefr: outcome.cefr,
      levelProgress: outcome.progress,
      consistencyStreak: outcome.streak,
      // Only a promotion restarts the window; otherwise the level is unchanged
      // and its history should keep accumulating.
      ...(outcome.promotedTo ? { levelAchievedAt: new Date() } : {}),
      /*
       * The teacher speaks at the band the learner actually holds. It used to
       * drift a step per session on the model's guess, which meant difficulty
       * moved for reasons the learner had not earned.
       */
      level: workspace.autoAdaptLevel
        ? CEFR_TO_TEACHING_LEVEL[outcome.cefr as keyof typeof CEFR_TO_TEACHING_LEVEL]
        : workspace.level,
      strengths: strengths.length ? strengths : workspace.strengths,
      weaknesses: weaknesses.length ? weaknesses : workspace.weaknesses,
      sessionsCompleted: workspace.sessionsCompleted + 1,
      totalPracticeSeconds:
        workspace.totalPracticeSeconds + Math.max(0, Math.round(args.durationSeconds)),
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspace.id))

  const minutes = Math.max(0, Math.round(args.durationSeconds / 60))
  await registerPractice({
    userId: args.userId,
    workspaceId: conversation.workspaceId,
    kind: 'conversation',
    seconds: args.durationSeconds,
    xp: XP.completeSession + minutes * XP.perMinuteSpoken,
    conversationId: conversation.id,
    score: speaking,
    countsAsSession: true,
    day: args.day,
  })

  return {
    reportId: report.id,
    unlocked: await syncAchievements(args.userId),
    promotedTo: outcome.promotedTo,
  }
}
