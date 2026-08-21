import 'server-only'

import { and, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { mistakeOccurrences, mistakes } from '@/lib/db/schema'
import type { CorrectionCategory } from '@/lib/db/schema'

const normalise = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()

/** Stable identity for "the same mistake", so counts accumulate instead of duplicating. */
export const mistakeSignature = (
  category: CorrectionCategory,
  original: string,
  corrected: string,
) => `${category}:${normalise(original)}>${normalise(corrected)}`

export type RecordableCorrection = {
  category: CorrectionCategory
  original: string
  corrected: string
  explanation?: string | null
  sentence?: string | null
}

/**
 * Folds live corrections into the user's recurring-mistake ledger. Called on
 * every turn so `My mistakes` reflects reality even if a session is abandoned.
 */
export function recordMistakes(
  userId: string,
  conversationId: string | null,
  items: RecordableCorrection[],
) {
  for (const item of items) {
    const signature = mistakeSignature(item.category, item.original, item.corrected)
    if (signature.endsWith('>')) continue

    const now = new Date()
    const row = db
      .insert(mistakes)
      .values({
        userId,
        category: item.category,
        signature,
        original: item.original,
        corrected: item.corrected,
        explanation: item.explanation ?? null,
        occurrences: 1,
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: [mistakes.userId, mistakes.signature],
        set: {
          occurrences: sql`${mistakes.occurrences} + 1`,
          lastSeenAt: now,
          // A mistake that comes back is open again.
          status: 'open',
          explanation: sql`coalesce(${mistakes.explanation}, ${item.explanation ?? null})`,
        },
      })
      .returning({ id: mistakes.id })
      .get()

    db.insert(mistakeOccurrences)
      .values({
        mistakeId: row.id,
        userId,
        conversationId,
        sentence: item.sentence ?? null,
      })
      .run()
  }
}

/** The mistakes the teacher should keep an eye on, most frequent first. */
export function topMistakes(userId: string, limit = 6) {
  return db
    .select({
      original: mistakes.original,
      corrected: mistakes.corrected,
      category: mistakes.category,
      occurrences: mistakes.occurrences,
    })
    .from(mistakes)
    .where(and(eq(mistakes.userId, userId), eq(mistakes.status, 'open')))
    .orderBy(desc(mistakes.occurrences), desc(mistakes.lastSeenAt))
    .limit(limit)
    .all()
}
