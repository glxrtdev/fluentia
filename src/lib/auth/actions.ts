'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, eq, ne } from 'drizzle-orm'

import { hashPassword, sha256, verifyPassword } from '@/lib/crypto'
import { db } from '@/lib/db'
import { goals, profiles, sessions, userSettings, users } from '@/lib/db/schema'
import { rateLimit } from '@/lib/rate-limit'
import { changePasswordSchema, fieldErrors, signInSchema, signUpSchema } from '@/lib/validation'

import { createSession, destroySession, requireUser, SESSION_COOKIE } from './session'

export type AuthState = { ok?: boolean; errors?: Record<string, string> } | undefined

async function clientKey(prefix: string) {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'local'
  return `${prefix}:${ip}`
}

/** Sensible starting goals so the dashboard is meaningful from day one. */
async function seedDefaults(userId: string) {
  await db.insert(profiles).values({ userId }).onConflictDoNothing()
  await db.insert(userSettings).values({ userId }).onConflictDoNothing()
  await db
    .insert(goals)
    .values([
      { userId, kind: 'weekly_sessions' as const, target: 5 },
      { userId, kind: 'weekly_minutes' as const, target: 100 },
      { userId, kind: 'weekly_words' as const, target: 20 },
      { userId, kind: 'weekly_mistakes' as const, target: 10 },
    ])
    .onConflictDoNothing()
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const limit = rateLimit(await clientKey('signup'), 10, 60 * 60_000)
  if (!limit.ok) return { errors: { form: 'Too many attempts. Try again later.' } }

  const parsed = signUpSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const { name, email, password } = parsed.data
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
  if (existing) return { errors: { email: 'That email is already registered.' } }

  const [user] = await db
    .insert(users)
    .values({ name, email, passwordHash: hashPassword(password) })
    .returning({ id: users.id })

  await seedDefaults(user.id)
  await createSession(user.id)
  redirect('/onboarding')
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const limit = rateLimit(await clientKey('signin'), 12, 15 * 60_000)
  if (!limit.ok) return { errors: { form: 'Too many attempts. Try again in a few minutes.' } }

  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1)
  // Same message either way so the form never reveals which emails exist.
  const invalid = { errors: { form: 'Email or password is incorrect.' } }
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) return invalid

  await seedDefaults(user.id)
  await createSession(user.id)
  redirect('/dashboard')
}

export async function signOut() {
  await destroySession()
  redirect('/login')
}

/**
 * Changing your own password. Requires the current one, so a borrowed session
 * cannot lock the real owner out, and every other session is signed out after.
 */
export async function changePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const user = await requireUser()

  const limit = rateLimit(`password:${user.id}`, 10, 15 * 60_000)
  if (!limit.ok) return { errors: { form: 'Too many attempts. Try again in a few minutes.' } }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1)

  if (!row || !verifyPassword(parsed.data.currentPassword, row.passwordHash)) {
    return { errors: { currentPassword: 'That is not your current password.' } }
  }

  await db
    .update(users)
    .set({ passwordHash: hashPassword(parsed.data.password) })
    .where(eq(users.id, user.id))

  // Keep this browser signed in; drop every other session.
  const jar = await cookies()
  const current = jar.get(SESSION_COOKIE)?.value
  await db
    .delete(sessions)
    .where(
      current
        ? and(eq(sessions.userId, user.id), ne(sessions.id, sha256(current)))
        : eq(sessions.userId, user.id),
    )

  return { ok: true }
}
