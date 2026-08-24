import 'server-only'

import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { conversations, profiles, sessionReports } from '@/lib/db/schema'
import type { EnglishLevel } from '@/lib/db/schema'
import { ENGLISH_LEVELS } from '@/lib/db/schema'
import { conversationCorrections, conversationTranscript } from '@/lib/domain/conversation'
import {
  registerPractice,
  syncAchievements,
  XP,
  type UnlockedAchievement,
} from '@/lib/domain/gamification'
import { AiError, type UserAi } from '@/lib/openai/client'
import { buildReportPrompt, REPORT_SCHEMA } from '@/lib/openai/prompts'
import { clamp } from '@/lib/utils'

const CEFR_TO_LEVEL: Record<string, EnglishLevel> = {
  A1: 'beginner',
  A2: 'elementary',
  B1: 'intermediate',
  B2: 'upper-intermediate',
  C1: 'advanced',
  C2: 'advanced',
}

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

/** Moves a level one step towards `target` — never a jump. */
function nudgeLevel(current: EnglishLevel, target: EnglishLevel): EnglishLevel {
  const from = ENGLISH_LEVELS.indexOf(current)
  const to = ENGLISH_LEVELS.indexOf(target)
  if (from === to || to < 0) return current
  return ENGLISH_LEVELS[from + (to > from ? 1 : -1)]
}

/**
 * Closes a session: asks the model to assess the transcript, stores the report,
 * updates the learning profile, awards XP and unlocks achievements.
 */
export async function finishConversation(args: {
  ai: UserAi
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
    throw new AiError('There is nothing to report on yet — say something first.', 400)
  }

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, args.userId))
    .limit(1)
  if (!profile) throw new AiError('Your profile is missing.', 500)

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

  const completion = await args.ai.client.chat.completions.create({
    model: args.ai.models.chat,
    temperature: 0.3,
    max_tokens: 1200,
    messages: [
      {
        role: 'system',
        content: buildReportPrompt({
          learnerName: args.learnerName,
          level: conversation.level,
          topicLabel: conversation.topicLabel,
          durationSeconds: args.durationSeconds,
          correctionCount: corrections.length,
        }),
      },
      {
        role: 'user',
        content: `TRANSCRIPT\n${dialogue}\n\nCORRECTIONS RAISED LIVE\n${
          liveCorrections || '(none)'
        }\n\nThe learner spoke ${wordsSpoken} words across ${userTurns.length} turns.`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'session_report', strict: true, schema: REPORT_SCHEMA },
    },
  })

  const content = completion.choices[0]?.message?.content
  if (!content) throw new AiError('The report came back empty. Your session is still saved.')

  let raw: RawReport
  try {
    raw = JSON.parse(content) as RawReport
  } catch {
    throw new AiError('The report could not be read. Your session is still saved.')
  }

  const baseline = 60
  const speaking = score(raw.speaking, baseline)
  const pronunciationRaw = raw.pronunciation
  const estimatedCefr =
    typeof raw.estimated_level === 'string' && CEFR_TO_LEVEL[raw.estimated_level]
      ? raw.estimated_level
      : (profile.estimatedCefr ?? 'B1')

  const [report] = await db
    .insert(sessionReports)
    .values({
      conversationId: conversation.id,
      userId: args.userId,
      speaking,
      grammar: score(raw.grammar, speaking),
      vocabulary: score(raw.vocabulary, speaking),
      fluency: score(raw.fluency, speaking),
      pronunciation:
        pronunciationRaw === null || pronunciationRaw === undefined
          ? null
          : score(pronunciationRaw, speaking),
      estimatedLevel: estimatedCefr,
      summary: String(raw.summary ?? '').trim().slice(0, 1200) || 'Session completed.',
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

  // The profile is the memory the next conversation reads from.
  const strengths = stringList(raw.strengths, 3)
  const weaknesses = stringList(raw.weaknesses, 3)
  const enoughEvidence = userTurns.length >= 4
  const nextLevel =
    profile.autoAdaptLevel && enoughEvidence
      ? nudgeLevel(profile.level, CEFR_TO_LEVEL[estimatedCefr] ?? profile.level)
      : profile.level

  await db.update(profiles)
    .set({
      estimatedCefr,
      level: nextLevel,
      strengths: strengths.length ? strengths : profile.strengths,
      weaknesses: weaknesses.length ? weaknesses : profile.weaknesses,
      sessionsCompleted: profile.sessionsCompleted + 1,
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, args.userId))

  const minutes = Math.max(0, Math.round(args.durationSeconds / 60))
  await registerPractice({
    userId: args.userId,
    kind: 'conversation',
    seconds: args.durationSeconds,
    xp: XP.completeSession + minutes * XP.perMinuteSpoken,
    conversationId: conversation.id,
    score: speaking,
    countsAsSession: true,
    day: args.day,
  })

  return { reportId: report.id, unlocked: await syncAchievements(args.userId) }
}
