'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { hashPassword, verifyPassword } from '@/lib/crypto'
import { db } from '@/lib/db'
import { goals, profiles, userSettings, users } from '@/lib/db/schema'
import { rateLimit } from '@/lib/rate-limit'
import { fieldErrors, signInSchema, signUpSchema } from '@/lib/validation'

import { createSession, destroySession } from './session'

export type AuthState = { errors?: Record<string, string> } | undefined

async function clientKey(prefix: string) {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'local'
  return `${prefix}:${ip}`
}

/** Sensible starting goals so the dashboard is meaningful from day one. */
function seedDefaults(userId: string) {
  db.insert(profiles).values({ userId }).onConflictDoNothing().run()
  db.insert(userSettings).values({ userId }).onConflictDoNothing().run()
  db.insert(goals)
    .values([
      { userId, kind: 'weekly_sessions' as const, target: 5 },
      { userId, kind: 'weekly_minutes' as const, target: 100 },
      { userId, kind: 'weekly_words' as const, target: 20 },
      { userId, kind: 'weekly_mistakes' as const, target: 10 },
    ])
    .onConflictDoNothing()
    .run()
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const limit = rateLimit(await clientKey('signup'), 10, 60 * 60_000)
  if (!limit.ok) return { errors: { form: 'Too many attempts. Try again later.' } }

  const parsed = signUpSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const { name, email, password } = parsed.data
  const existing = db.select({ id: users.id }).from(users).where(eq(users.email, email)).get()
  if (existing) return { errors: { email: 'That email is already registered.' } }

  const user = db
    .insert(users)
    .values({ name, email, passwordHash: hashPassword(password) })
    .returning({ id: users.id })
    .get()

  seedDefaults(user.id)
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

  const user = db.select().from(users).where(eq(users.email, parsed.data.email)).get()
  // Same message either way so the form never reveals which emails exist.
  const invalid = { errors: { form: 'Email or password is incorrect.' } }
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) return invalid

  seedDefaults(user.id)
  await createSession(user.id)
  redirect('/dashboard')
}

export async function signOut() {
  await destroySession()
  redirect('/login')
}
