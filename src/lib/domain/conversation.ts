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
export function getOwnedConversation(userId: string, conversationId: string) {
  return db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .get()
}

export function conversationHistory(conversationId: string, limit = 24) {
  const rows = db
    .select({
      role: conversationMessages.role,
      content: conversationMessages.content,
      seq: conversationMessages.seq,
    })
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(desc(conversationMessages.seq))
    .limit(limit)
    .all()

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
    .all()
}

export function conversationCorrections(conversationId: string) {
  return db
    .select()
    .from(corrections)
    .where(eq(corrections.conversationId, conversationId))
    .orderBy(asc(corrections.createdAt))
    .all()
}

/** Builds the system prompt for a turn from the learner's live profile. */
export function buildPromptFor(
  userId: string,
  learnerName: string,
  conversation: { topicId: string | null; topicLabel: string; customBrief: string | null; level: string },
) {
  const profile = db.select().from(profiles).where(eq(profiles.userId, userId)).get()
  const topic = conversation.topicId ? TOPIC_BY_ID.get(conversation.topicId) : undefined

  const brief =
    conversation.customBrief?.trim() ||
    topic?.brief ||
    `Have a natural conversation about ${conversation.topicLabel}.`

  const studying = db
    .select({ word: vocabulary.word })
    .from(vocabulary)
    .where(and(eq(vocabulary.userId, userId), eq(vocabulary.status, 'learning')))
    .orderBy(desc(vocabulary.createdAt))
    .limit(20)
    .all()
    .map((row) => row.word)

  return buildTeacherPrompt({
    learnerName,
    level: conversation.level as EnglishLevel,
    topicLabel: conversation.topicLabel,
    topicBrief: brief,
    mainGoal: profile?.mainGoal ?? null,
    interests: profile?.interests ?? [],
    focusMistakes: topMistakes(userId, 6),
    activeVocabulary: studying,
  })
}

export function nextSeq(conversationId: string) {
  const row = db
    .select({ max: sql<number>`coalesce(max(${conversationMessages.seq}), -1)` })
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .get()
  return (row?.max ?? -1) + 1
}

export type StoredMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  seq: number
  createdAt: Date
}

export function appendMessage(args: {
  conversationId: string
  userId: string
  role: 'user' | 'assistant'
  content: string
  seq: number
  audioMs?: number | null
}): StoredMessage {
  return db
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
    .get() as StoredMessage
}

export function saveCorrections(args: {
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
    .all()
}
