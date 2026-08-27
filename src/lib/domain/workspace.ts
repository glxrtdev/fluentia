import 'server-only'

import { cache } from 'react'
import { and, asc, eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { goals, userSettings, workspaces } from '@/lib/db/schema'
import {
  DEFAULT_LANGUAGE,
  MAX_WORKSPACES,
  getLanguage,
  isLanguageCode,
  type LanguageCode,
} from '@/lib/languages'

export type Workspace = typeof workspaces.$inferSelect

/** The self-assessment at onboarding, read as a starting band. */
const LEVEL_TO_CEFR: Record<string, string> = {
  beginner: 'A1',
  elementary: 'A2',
  intermediate: 'B1',
  'upper-intermediate': 'B2',
  advanced: 'C1',
}

export class WorkspaceError extends Error {}

/** Every workspace on the account, oldest first so the order never jumps. */
export const listWorkspaces = cache(async (userId: string): Promise<Workspace[]> =>
  db.select().from(workspaces).where(eq(workspaces.userId, userId)).orderBy(asc(workspaces.createdAt)),
)

/**
 * The workspace the learner is working in.
 *
 * Falls back to the oldest one when the stored id is missing or stale — a
 * deleted workspace should drop you into another, never into a dead end. Only
 * an account with no workspaces at all returns null, which the onboarding flow
 * then handles.
 */
export async function resolveWorkspace(
  userId: string,
  activeId: string | null,
): Promise<Workspace | null> {
  const all = await listWorkspaces(userId)
  if (all.length === 0) return null
  return all.find((workspace) => workspace.id === activeId) ?? all[0]
}

/** Reads one workspace, refusing to cross accounts. */
export async function getOwnedWorkspace(userId: string, id: string): Promise<Workspace | null> {
  const [row] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)))
    .limit(1)
  return row ?? null
}

/**
 * Opens a new language.
 *
 * The cap is enforced here rather than in the form, because the form is not
 * the only way in. Two spaces for the same language are refused too: they
 * would split one learner's history in half for no benefit.
 */
export async function createWorkspace(
  userId: string,
  language: string,
  seed: Partial<Pick<Workspace, 'level' | 'mainGoal' | 'interests' | 'dailyMinutesGoal'>> = {},
): Promise<Workspace> {
  if (!isLanguageCode(language)) throw new WorkspaceError('Esse idioma não está disponível.')

  const existing = await listWorkspaces(userId)
  if (existing.length >= MAX_WORKSPACES) {
    throw new WorkspaceError(
      `Você pode praticar ${MAX_WORKSPACES} idiomas por vez. Remova um para adicionar outro.`,
    )
  }
  if (existing.some((workspace) => workspace.language === language)) {
    throw new WorkspaceError(`Você já tem um espaço de ${getLanguage(language).name.pt}.`)
  }

  /*
   * The declared level is the starting official level. Without this a learner
   * who called themselves intermediate would begin at A1 and have the teacher
   * drop to beginner after their first session — a demotion they never earned
   * and never asked for.
   */
  const [created] = await db
    .insert(workspaces)
    .values({
      userId,
      language,
      ...seed,
      officialCefr: LEVEL_TO_CEFR[seed.level ?? 'intermediate'] ?? 'B1',
    })
    .returning()

  if (!created) throw new WorkspaceError('Não foi possível criar o espaço.')

  // Starting goals, so the dashboard says something on day one.
  await db
    .insert(goals)
    .values([
      { userId, workspaceId: created.id, kind: 'weekly_sessions' as const, target: 5 },
      { userId, workspaceId: created.id, kind: 'weekly_minutes' as const, target: 100 },
      { userId, workspaceId: created.id, kind: 'weekly_words' as const, target: 20 },
      { userId, workspaceId: created.id, kind: 'weekly_mistakes' as const, target: 10 },
    ])
    .onConflictDoNothing()

  await switchWorkspace(userId, created.id)
  return created
}

/**
 * Makes a workspace the active one.
 *
 * Nothing is forced about the interface: each space carries its own choice, so
 * translating the Japanese one never touches the Spanish one.
 */
export async function switchWorkspace(userId: string, workspaceId: string): Promise<void> {
  const workspace = await getOwnedWorkspace(userId, workspaceId)
  if (!workspace) throw new WorkspaceError('Esse espaço não existe.')

  await db
    .update(userSettings)
    .set({ activeWorkspaceId: workspaceId, updatedAt: new Date() })
    .where(eq(userSettings.userId, userId))
}

/**
 * Closes a language for good, along with everything learned in it.
 *
 * The last one cannot go: an account with no workspace has nowhere to land.
 */
export async function deleteWorkspace(userId: string, workspaceId: string): Promise<void> {
  const all = await listWorkspaces(userId)
  if (all.length <= 1) {
    throw new WorkspaceError('Este é seu único idioma. Adicione outro antes de remover este.')
  }
  if (!all.some((workspace) => workspace.id === workspaceId)) {
    throw new WorkspaceError('Esse espaço não existe.')
  }

  await db.delete(workspaces).where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)))

  // Whoever is left inherits the active slot.
  const remaining = all.find((workspace) => workspace.id !== workspaceId)!
  await db
    .update(userSettings)
    .set({ activeWorkspaceId: remaining.id, updatedAt: new Date() })
    .where(and(eq(userSettings.userId, userId), eq(userSettings.activeWorkspaceId, workspaceId)))
}

/** The languages this account has not opened yet. */
export async function availableLanguages(userId: string): Promise<LanguageCode[]> {
  const taken = new Set((await listWorkspaces(userId)).map((workspace) => workspace.language))
  const { LANGUAGE_CODES } = await import('@/lib/languages')
  return LANGUAGE_CODES.filter((code) => !taken.has(code))
}

/** Adds practice time and a finished session to the workspace's totals. */
export async function recordWorkspacePractice(
  workspaceId: string,
  seconds: number,
): Promise<void> {
  await db
    .update(workspaces)
    .set({
      totalPracticeSeconds: sql`${workspaces.totalPracticeSeconds} + ${Math.max(0, seconds)}`,
      sessionsCompleted: sql`${workspaces.sessionsCompleted} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspaceId))
}

export { DEFAULT_LANGUAGE, MAX_WORKSPACES }
