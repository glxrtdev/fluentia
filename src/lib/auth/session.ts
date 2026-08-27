import 'server-only'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, eq, gt, lt } from 'drizzle-orm'

import { randomToken, sha256 } from '@/lib/crypto'
import { db } from '@/lib/db'
import { profiles, sessions, userSettings, users, workspaces } from '@/lib/db/schema'

export const SESSION_COOKIE = 'fluentia_session'
const SESSION_DAYS = 30

export type SessionUser = {
  id: string
  email: string
  name: string
  createdAt: Date
}

/** Issues an opaque session token; only its SHA-256 is stored server side. */
export async function createSession(userId: string) {
  const token = randomToken()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000)

  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt })
  // Opportunistic cleanup of this user's expired sessions.
  await db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())))

  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })
}

export async function destroySession() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)))
  jar.delete(SESSION_COOKIE)
}

/**
 * The session, the user, the profile, the settings and the open workspace in a
 * single round trip.
 *
 * Every authenticated page needs all of them, and the database is a long way
 * away: fetching them separately cost a sequential trip each on every
 * navigation. Memoized per request, so the layout and the page share one query.
 */
const loadContext = cache(async () => {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null

  const [row] = await db
    .select()
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(userSettings, eq(userSettings.userId, users.id))
    // The workspace the learner last had open. A stale id simply misses, and
    // `requireWorkspace` falls back to one that exists.
    .leftJoin(workspaces, eq(workspaces.id, userSettings.activeWorkspaceId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1)

  if (!row) return null

  return {
    user: {
      id: row.users.id,
      email: row.users.email,
      name: row.users.name,
      createdAt: row.users.createdAt,
    } satisfies SessionUser,
    profile: row.profiles,
    settings: row.user_settings,
    workspace: row.workspaces,
  }
})

/** Resolves the signed-in user. Returns null when there is no valid session. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await loadContext())?.user ?? null
}

/** Every authenticated page and route handler starts here. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

/** For route handlers: returns the user or throws a 401 Response. */
export async function requireUserOrThrow(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw Response.json({ error: 'Não autenticado' }, { status: 401 })
  }
  return user
}

export async function getProfile(userId: string) {
  const context = await loadContext()
  if (context?.user.id === userId && context.profile) return context.profile

  const [row] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1)
  if (row) return row

  // A user without a profile row only happens if seeding was interrupted.
  await db.insert(profiles).values({ userId }).onConflictDoNothing()
  const [created] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1)
  return created!
}

export async function getSettings(userId: string) {
  const context = await loadContext()
  if (context?.user.id === userId && context.settings) return context.settings

  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1)
  if (row) return row

  await db.insert(userSettings).values({ userId }).onConflictDoNothing()
  const [created] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1)
  return created!
}

/**
 * The workspace the learner is working in, resolved from settings.
 *
 * The common case costs nothing extra — it rode along on the session query.
 * Only a missing or stale pointer pays for a lookup.
 */
export async function getActiveWorkspace(userId: string) {
  const context = await loadContext()
  if (context?.user.id === userId && context.workspace) return context.workspace

  const { resolveWorkspace } = await import('@/lib/domain/workspace')
  return resolveWorkspace(userId, context?.settings?.activeWorkspaceId ?? null)
}

/**
 * Every page that shows learning content starts here.
 *
 * An account with no workspace has not finished onboarding, so it is sent
 * there rather than shown an empty dashboard.
 */
export async function requireWorkspace(userId: string) {
  const workspace = await getActiveWorkspace(userId)
  if (!workspace) redirect('/onboarding')
  return workspace
}

/** For route handlers: the workspace or a 409 Response. */
export async function requireWorkspaceOrThrow(userId: string) {
  const workspace = await getActiveWorkspace(userId)
  if (!workspace) {
    throw Response.json({ error: 'Nenhum espaço de idioma está aberto.' }, { status: 409 })
  }
  return workspace
}
