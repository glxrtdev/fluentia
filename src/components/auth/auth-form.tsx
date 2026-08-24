'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import type { AuthState } from '@/lib/auth/actions'

type Action = (state: AuthState, formData: FormData) => Promise<AuthState>

export function AuthForm({ mode, action }: { mode: 'login' | 'signup'; action: Action }) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const errors = state?.errors ?? {}
  const isSignup = mode === 'signup'

  return (
    <div>
      <h1 className="display text-[2rem] leading-tight text-ink">
        {isSignup ? 'Create your account' : 'Welcome back'}
      </h1>
      <p className="mt-2 text-[0.875rem] leading-relaxed text-muted">
        {isSignup
          ? 'Two fields and a password. Your OpenAI key comes later, in settings.'
          : 'Pick up where your last conversation stopped.'}
      </p>

      <form action={formAction} className="mt-8 space-y-4" noValidate>
        {errors.form && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose/25 bg-rose/8 px-3.5 py-3 text-[0.8125rem] font-medium text-rose"
          >
            <AlertCircle className="mt-px size-4 shrink-0" />
            {errors.form}
          </p>
        )}

        {isSignup && (
          <Field label="Name" error={errors.name}>
            <Input name="name" autoComplete="name" placeholder="Your name" required />
          </Field>
        )}

        <Field label="Email" error={errors.email}>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </Field>

        <Field
          label="Password"
          error={errors.password}
          hint={isSignup ? 'At least 8 characters.' : undefined}
        >
          <Input
            name="password"
            type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            placeholder="••••••••"
            required
          />
        </Field>

        {/* There is no reset email, so a typo here has to be caught now. */}
        {isSignup && (
          <Field label="Confirm password" error={errors.confirmPassword}>
            <Input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              required
            />
          </Field>
        )}

        <Button type="submit" size="lg" loading={pending} className="w-full">
          {isSignup ? 'Create account' : 'Log in'}
        </Button>
      </form>

      <p className="mt-6 text-center text-[0.8125rem] text-muted">
        {isSignup ? 'Already have an account? ' : 'New to Fluentia? '}
        <Link
          href={isSignup ? '/login' : '/signup'}
          className="font-semibold text-brand-600 transition-opacity hover:opacity-80 dark:text-brand-400"
        >
          {isSignup ? 'Log in' : 'Create an account'}
        </Link>
      </p>
    </div>
  )
}
