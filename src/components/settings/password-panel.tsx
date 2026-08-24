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
        title="Password"
        hint="Changing it signs out every other device. This one stays signed in."
      />

      <form
        ref={form}
        action={async (data) => {
          await formAction(data)
          form.current?.reset()
        }}
        className="space-y-4"
      >
        <Field label="Current password" error={state?.errors?.currentPassword}>
          <Input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password" error={state?.errors?.password} hint="At least 8 characters.">
            <Input
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              required
            />
          </Field>

          <Field label="Confirm new password" error={state?.errors?.confirmPassword}>
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
            Password updated.
          </p>
        )}

        <Button type="submit" variant="secondary" loading={pending}>
          Change password
        </Button>
      </form>

      <p className="mt-6 border-t border-line pt-5 text-xs leading-relaxed text-muted">
        Locked out of an account? Fluentia does not send email, so recovery runs from the machine
        that owns the database:{' '}
        <code className="font-mono text-ink">npm run set-password -- you@example.com</code>
      </p>
    </Card>
  )
}
