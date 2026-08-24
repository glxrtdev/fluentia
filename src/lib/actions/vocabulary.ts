'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, sql } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { vocabulary } from '@/lib/db/schema'
import { addXp, syncAchievements, XP } from '@/lib/domain/gamification'
import { addVocabularySchema, vocabularyStatusSchema } from '@/lib/validation'

export type VocabState = { ok?: boolean; error?: string; word?: string } | undefined

/** Saves a word the learner looked up or met in a conversation. */
export async function addWord(input: unknown): Promise<VocabState> {
  const user = await requireUser()

  const parsed = addVocabularySchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'That word could not be saved.' }

  const data = parsed.data
  const word = data.word.toLowerCase()

  const [existing] = await db
    .select({ id: vocabulary.id })
    .from(vocabulary)
    .where(and(eq(vocabulary.userId, user.id), eq(vocabulary.word, word)))
    .limit(1)

  if (existing) {
    revalidatePath('/vocabulary')
    return { ok: true, word, error: 'Already in your vocabulary.' }
  }

  await db
    .insert(vocabulary)
    .values({
      userId: user.id,
      word,
      partOfSpeech: data.partOfSpeech ?? null,
      phonetic: data.phonetic ?? null,
      definition: data.definition,
      example: data.example ?? null,
      translation: data.translation ?? null,
      audioUrl: data.audioUrl ?? null,
      related: data.related ?? [],
      source: data.source ?? 'dictionary',
      status: 'learning',
    })

  await addXp(user.id, XP.wordLearned)
  await syncAchievements(user.id)

  revalidatePath('/vocabulary')
  revalidatePath('/dashboard')
  return { ok: true, word }
}

export async function setWordStatus(id: string, status: string): Promise<VocabState> {
  const user = await requireUser()

  const parsed = vocabularyStatusSchema.safeParse({ status })
  if (!parsed.success) return { error: 'Unknown status.' }

  const [updated] = await db
    .update(vocabulary)
    .set({
      status: parsed.data.status,
      reviewCount:
        parsed.data.status === 'learned' ? sql`${vocabulary.reviewCount} + 1` : vocabulary.reviewCount,
      updatedAt: new Date(),
    })
    .where(and(eq(vocabulary.id, id), eq(vocabulary.userId, user.id)))
    .returning({ id: vocabulary.id })

  if (!updated) return { error: 'Word not found.' }

  if (parsed.data.status === 'learned') await syncAchievements(user.id)

  revalidatePath('/vocabulary')
  return { ok: true }
}

export async function removeWord(id: string): Promise<VocabState> {
  const user = await requireUser()

  await db
    .delete(vocabulary)
    .where(and(eq(vocabulary.id, id), eq(vocabulary.userId, user.id)))

  revalidatePath('/vocabulary')
  return { ok: true }
}
