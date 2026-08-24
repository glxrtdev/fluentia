import 'server-only'

import { and, asc, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  conversationMessages,
  conversations,
  corrections,
  profiles,
  vocabulary,
} from '@/lib/db/schema'
import type { EnglishLevel } from '@/lib/db/schema'
import { topMistakes } from '@/lib/domain/mistakes'
import { TOPIC_BY_ID } from '@/lib/domain/topics'
import { buildTeacherPrompt } from '@/lib/openai/prompts'
import type { TurnCorrection } from '@/lib/openai/conversation'

/** Loads a conversation only if it belongs to the caller. */
export async function getOwnedConversation(userId: string, conversationId: string) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1)
  return row
}

export async function conversationHistory(conversationId: string, limit = 24) {
  const rows = await db
    .select({
      role: conversationMessages.role,
      content: conversationMessages.content,
      seq: conversationMessages.seq,
    })
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(desc(conversationMessages.seq))
    .limit(limit)

  return rows.reverse().map(({ role, content }) => ({ role, content }))
}

export function conversationTranscript(conversationId: string) {
  return db
    .select({
      id: conversationMessages.id,
      role: conversationMessages.role,
      content: conversationMessages.content,
      createdAt: conversationMessages.createdAt,
      seq: conversationMessages.seq,
    })
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(asc(conversationMessages.seq))
}

export function conversationCorrections(conversationId: string) {
  return db
    .select()
    .from(corrections)
    .where(eq(corrections.conversationId, conversationId))
    .orderBy(asc(corrections.createdAt))
}

/** Builds the system prompt for a turn from the learner's live profile. */
export async function buildPromptFor(
  userId: string,
  learnerName: string,
  conversation: {
    topicId: string | null
    topicLabel: string
    customBrief: string | null
    level: string
  },
) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1)
  const topic = conversation.topicId ? TOPIC_BY_ID.get(conversation.topicId) : undefined

  const brief =
    conversation.customBrief?.trim() ||
    topic?.brief ||
    `Have a natural conversation about ${conversation.topicLabel}.`

  const [studying, focusMistakes] = await Promise.all([
    db
      .select({ word: vocabulary.word })
      .from(vocabulary)
      .where(and(eq(vocabulary.userId, userId), eq(vocabulary.status, 'learning')))
      .orderBy(desc(vocabulary.createdAt))
      .limit(20),
    topMistakes(userId, 6),
  ])

  return buildTeacherPrompt({
    learnerName,
    level: conversation.level as EnglishLevel,
    topicLabel: conversation.topicLabel,
    topicBrief: brief,
    mainGoal: profile?.mainGoal ?? null,
    interests: profile?.interests ?? [],
    focusMistakes,
    activeVocabulary: studying.map((row) => row.word),
  })
}

export async function nextSeq(conversationId: string) {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${conversationMessages.seq}), -1)` })
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))

  return Number(row?.max ?? -1) + 1
}

export type StoredMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  seq: number
  createdAt: Date
}

export async function appendMessage(args: {
  conversationId: string
  userId: string
  role: 'user' | 'assistant'
  content: string
  seq: number
  audioMs?: number | null
}): Promise<StoredMessage> {
  const [row] = await db
    .insert(conversationMessages)
    .values({
      conversationId: args.conversationId,
      userId: args.userId,
      role: args.role,
      content: args.content,
      seq: args.seq,
      audioMs: args.audioMs ?? null,
    })
    .returning({
      id: conversationMessages.id,
      role: conversationMessages.role,
      content: conversationMessages.content,
      seq: conversationMessages.seq,
      createdAt: conversationMessages.createdAt,
    })

  return row as StoredMessage
}

export async function saveCorrections(args: {
  userId: string
  conversationId: string
  messageId: string
  items: TurnCorrection[]
}) {
  if (args.items.length === 0) return []

  return db
    .insert(corrections)
    .values(
      args.items.map((item) => ({
        userId: args.userId,
        conversationId: args.conversationId,
        messageId: args.messageId,
        category: item.category,
        original: item.original,
        corrected: item.corrected,
        explanation: item.explanation || null,
        betterSentence: item.betterSentence,
        severity: item.severity,
      })),
    )
    .returning()
}

/**
 * Both sides of a turn in one round trip. The database is far away: two inserts
 * that could be one are a tenth of a second the learner spends waiting.
 */
export async function appendTurn(args: {
  conversationId: string
  userId: string
  seq: number
  userContent: string
  assistantContent: string
  audioMs?: number | null
}): Promise<{ user: StoredMessage; assistant: StoredMessage }> {
  const rows = await db
    .insert(conversationMessages)
    .values([
      {
        conversationId: args.conversationId,
        userId: args.userId,
        role: 'user' as const,
        content: args.userContent,
        seq: args.seq,
        audioMs: args.audioMs ?? null,
      },
      {
        conversationId: args.conversationId,
        userId: args.userId,
        role: 'assistant' as const,
        content: args.assistantContent,
        seq: args.seq + 1,
      },
    ])
    .returning({
      id: conversationMessages.id,
      role: conversationMessages.role,
      content: conversationMessages.content,
      seq: conversationMessages.seq,
      createdAt: conversationMessages.createdAt,
    })

  const user = rows.find((row) => row.role === 'user') as StoredMessage
  const assistant = rows.find((row) => row.role === 'assistant') as StoredMessage
  return { user, assistant }
}
