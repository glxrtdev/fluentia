'use client'

import { useActionState, useRef } from 'react'
import { CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { changePassword } from '@/lib/auth/actions'

export function PasswordPanel() {
  const form = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(changePassword, undefined)

  return (
    <Card>
      <CardHeader
        title="Senha"
        hint="Trocar a senha desconecta todos os outros aparelhos. Este continua conectado."
      />

      <form
        ref={form}
        action={async (data) => {
          await formAction(data)
          form.current?.reset()
        }}
        className="space-y-4"
      >
        <Field label="Senha atual" error={state?.errors?.currentPassword}>
          <Input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nova senha" error={state?.errors?.password} hint="Pelo menos 8 caracteres.">
            <Input
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              required
            />
          </Field>

          <Field label="Confirme a nova senha" error={state?.errors?.confirmPassword}>
            <Input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              required
            />
          </Field>
        </div>

        {state?.errors?.form && (
          <p role="alert" className="text-[0.8125rem] font-medium text-rose">
            {state.errors.form}
          </p>
        )}

        {state?.ok && (
          <p className="flex items-center gap-2 text-[0.8125rem] font-medium text-brand-600 dark:text-brand-400">
            <CheckCircle2 className="size-4" />
            Senha atualizada.
          </p>
        )}

        <Button type="submit" variant="secondary" loading={pending}>
          Trocar senha
        </Button>
      </form>

      <p className="mt-6 border-t border-line pt-5 text-xs leading-relaxed text-muted">
        Perdeu o acesso? A Fluentia não envia e-mail, então a recuperação é feita pela máquina
        dona do banco:{' '}
        <code className="font-mono text-ink">npm run set-password -- you@example.com</code>
      </p>
    </Card>
  )
}
