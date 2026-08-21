'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { mistakes } from '@/lib/db/schema'
import { addXp, syncAchievements, XP } from '@/lib/domain/gamification'
import { mistakeStatusSchema } from '@/lib/validation'

/** Learner-driven status: "I get this now" or "still working on it". */
export async function setMistakeStatus(id: string, status: string) {
  const user = await requireUser()

  const parsed = mistakeStatusSchema.safeParse({ status })
  if (!parsed.success) return { error: 'Unknown status.' }

  const before = db
    .select({ status: mistakes.status })
    .from(mistakes)
    .where(and(eq(mistakes.id, id), eq(mistakes.userId, user.id)))
    .get()
  if (!before) return { error: 'Mistake not found.' }

  db.update(mistakes)
    .set({ status: parsed.data.status })
    .where(and(eq(mistakes.id, id), eq(mistakes.userId, user.id)))
    .run()

  // Resolving one is worth XP, but only the first time it happens.
  if (parsed.data.status === 'resolved' && before.status !== 'resolved') {
    addXp(user.id, XP.mistakeResolved)
    syncAchievements(user.id)
  }

  revalidatePath('/mistakes')
  revalidatePath('/dashboard')
  return { ok: true }
}
