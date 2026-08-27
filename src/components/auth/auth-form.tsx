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
        {isSignup ? 'Crie sua conta' : 'Bem-vindo de volta'}
      </h1>
      <p className="mt-2 text-[0.875rem] leading-relaxed text-muted">
        {isSignup
          ? 'Dois campos e uma senha. A chave da OpenAI vem depois, nas configurações.'
          : 'Continue de onde sua última conversa parou.'}
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
          <Field label="Nome" error={errors.name}>
            <Input name="name" autoComplete="name" placeholder="Seu nome" required />
          </Field>
        )}

        <Field label="E-mail" error={errors.email}>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            required
          />
        </Field>

        <Field
          label="Senha"
          error={errors.password}
          hint={isSignup ? 'Pelo menos 8 caracteres.' : undefined}
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
          <Field label="Confirme a senha" error={errors.confirmPassword}>
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
          {isSignup ? 'Criar conta' : 'Entrar'}
        </Button>
      </form>

      <p className="mt-6 text-center text-[0.8125rem] text-muted">
        {isSignup ? 'Já tem uma conta? ' : 'Novo na Fluentia? '}
        <Link
          href={isSignup ? '/login' : '/signup'}
          className="font-semibold text-brand-600 transition-opacity hover:opacity-80 dark:text-brand-400"
        >
          {isSignup ? 'Entrar' : 'Criar uma conta'}
        </Link>
      </p>
    </div>
  )
}
