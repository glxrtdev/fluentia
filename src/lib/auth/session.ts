import 'server-only'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, eq, gt, lt } from 'drizzle-orm'

import { randomToken, sha256 } from '@/lib/crypto'
import { db } from '@/lib/db'
import { profiles, sessions, userSettings, users } from '@/lib/db/schema'

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

  db.insert(sessions).values({ id: sha256(token), userId, expiresAt }).run()
  // Opportunistic cleanup of this user's expired sessions.
  db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date()))).run()

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
  if (token) db.delete(sessions).where(eq(sessions.id, sha256(token))).run()
  jar.delete(SESSION_COOKIE)
}

/**
 * Resolves the signed-in user, memoized per request. Returns null when there is
 * no valid, unexpired session.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null

  const row = db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .get()

  return row ?? null
})

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
    throw Response.json({ error: 'Not authenticated' }, { status: 401 })
  }
  return user
}

export const getProfile = cache(async (userId: string) => {
  const row = db.select().from(profiles).where(eq(profiles.userId, userId)).get()
  if (row) return row
  db.insert(profiles).values({ userId }).onConflictDoNothing().run()
  return db.select().from(profiles).where(eq(profiles.userId, userId)).get()!
})

export const getSettings = cache(async (userId: string) => {
  const row = db.select().from(userSettings).where(eq(userSettings.userId, userId)).get()
  if (row) return row
  db.insert(userSettings).values({ userId }).onConflictDoNothing().run()
  return db.select().from(userSettings).where(eq(userSettings.userId, userId)).get()!
})
