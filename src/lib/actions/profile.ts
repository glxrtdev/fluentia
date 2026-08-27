'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { requireUser, requireWorkspace } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { createWorkspace, WorkspaceError } from '@/lib/domain/workspace'
import { goals, profiles, users, workspaces } from '@/lib/db/schema'
import type { GoalKind } from '@/lib/db/schema'
import { fieldErrors, goalsSchema, onboardingSchema, profileSchema } from '@/lib/validation'
import { GOAL_KINDS } from '@/lib/db/schema'

export type FormState = { ok?: boolean; errors?: Record<string, string> } | undefined

const parseList = (value: FormDataEntryValue | null) =>
  String(value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 12)

export async function completeOnboarding(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser()

  const parsed = onboardingSchema.safeParse({
    name: formData.get('name') || user.name,
    language: formData.get('language'),
    level: formData.get('level'),
    autoAdaptLevel: formData.get('autoAdaptLevel') !== 'false',
    mainGoal: formData.get('mainGoal') || null,
    dailyMinutesGoal: Number(formData.get('dailyMinutesGoal') ?? 20),
    nativeLanguage: formData.get('nativeLanguage') || 'pt-BR',
    interests: parseList(formData.get('interests')),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const data = parsed.data

  // The workspace carries everything that describes progress in a language;
  // the profile keeps only what belongs to the person.
  try {
    await createWorkspace(user.id, data.language, {
      level: data.level,
      mainGoal: data.mainGoal,
      interests: data.interests,
      dailyMinutesGoal: data.dailyMinutesGoal,
    })
  } catch (error) {
    if (error instanceof WorkspaceError) return { errors: { form: error.message } }
    throw error
  }

  await db
    .update(profiles)
    .set({
      nativeLanguage: data.nativeLanguage,
      onboardedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, user.id))

  redirect('/dashboard')
}

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser()

  const parsed = profileSchema.safeParse({
    name: formData.get('name'),
    level: formData.get('level'),
    autoAdaptLevel: formData.get('autoAdaptLevel') === 'on' || formData.get('autoAdaptLevel') === 'true',
    mainGoal: formData.get('mainGoal') || null,
    dailyMinutesGoal: Number(formData.get('dailyMinutesGoal') ?? 20),
    nativeLanguage: formData.get('nativeLanguage') || 'pt-BR',
    interests: parseList(formData.get('interests')),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const data = parsed.data
  const workspace = await requireWorkspace(user.id)

  await db.update(users).set({ name: data.name }).where(eq(users.id, user.id))
  await db
    .update(profiles)
    .set({ nativeLanguage: data.nativeLanguage, updatedAt: new Date() })
    .where(eq(profiles.userId, user.id))
  await db
    .update(workspaces)
    .set({
      level: data.level,
      autoAdaptLevel: data.autoAdaptLevel,
      mainGoal: data.mainGoal,
      dailyMinutesGoal: data.dailyMinutesGoal,
      interests: data.interests,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspace.id))

  revalidatePath('/settings')
  revalidatePath('/profile')
  return { ok: true }
}

export async function updateGoals(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser()
  const workspace = await requireWorkspace(user.id)

  const parsed = goalsSchema.safeParse({
    goals: GOAL_KINDS.map((kind) => ({ kind, target: Number(formData.get(kind) ?? 0) })),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  for (const goal of parsed.data.goals) {
    await db
      .insert(goals)
      .values({
        userId: user.id,
        workspaceId: workspace.id,
        kind: goal.kind as GoalKind,
        target: goal.target,
      })
      .onConflictDoUpdate({
        target: [goals.workspaceId, goals.kind],
        set: { target: goal.target, active: goal.target > 0 },
      })
  }

  revalidatePath('/goals')
  revalidatePath('/dashboard')
  return { ok: true }
}
