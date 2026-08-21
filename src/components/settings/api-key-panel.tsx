'use client'

import { useActionState, useState, useTransition } from 'react'
import { AlertTriangle, CheckCircle2, ExternalLink, Eye, EyeOff, KeyRound, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { Badge } from '@/components/ui/misc'
import { removeApiKey, saveApiKey, testApiKey, type AiSettingsState } from '@/lib/actions/ai'
import { formatRelative } from '@/lib/utils'

export function ApiKeyPanel({
  hint,
  status,
  verifiedAt,
}: {
  hint: string | null
  status: 'unset' | 'ok' | 'invalid'
  verifiedAt: Date | null
}) {
  const [state, formAction, saving] = useActionState(saveApiKey, undefined)
  const [reveal, setReveal] = useState(false)
  const [result, setResult] = useState<AiSettingsState>(undefined)
  const [pending, startTransition] = useTransition()

  const feedback = result ?? state
  const configured = Boolean(hint)

  const run = (fn: () => Promise<AiSettingsState>) =>
    startTransition(async () => setResult(await fn()))

  return (
    <Card>
      <CardHeader
        title="OpenAI API key"
        hint="Fluentia runs on your own OpenAI account. The key is encrypted with AES-256-GCM before it touches the database and is only ever decrypted on the server — it is never sent to the browser."
        action={
          status === 'ok' ? (
            <Badge tone="brand">
              <CheckCircle2 className="size-3" />
              Connected
            </Badge>
          ) : status === 'invalid' ? (
            <Badge tone="rose">
              <AlertTriangle className="size-3" />
              Rejected
            </Badge>
          ) : (
            <Badge>Not configured</Badge>
          )
        }
      />

      {configured && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3">
          <div className="flex items-center gap-2.5 text-sm">
            <KeyRound className="size-4 text-muted" />
            <span className="font-mono text-ink">sk-••••••••••••{hint}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={pending}
              onClick={() => run(testApiKey)}
            >
              Test connection
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => run(removeApiKey)}
              aria-label="Remove key"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {verifiedAt && status === 'ok' && (
        <p className="mb-5 text-xs text-muted">Last verified {formatRelative(verifiedAt)}.</p>
      )}

      <form action={formAction} className="space-y-4">
        <Field
          label={configured ? 'Replace key' : 'API key'}
          error={feedback?.errors?.apiKey ?? feedback?.errors?.form}
          hint="Starts with sk-. Saving runs a live check against OpenAI straight away."
        >
          <div className="relative">
            <Input
              name="apiKey"
              type={reveal ? 'text' : 'password'}
              placeholder="sk-..."
              autoComplete="off"
              spellCheck={false}
              className="pr-11 font-mono text-[0.8125rem]"
              required
            />
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? 'Hide key' : 'Show key'}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-faint transition-colors hover:text-ink"
            >
              {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        {feedback?.ok && feedback.message && (
          <p className="flex items-center gap-2 text-[0.8125rem] font-medium text-brand-600 dark:text-brand-400">
            <CheckCircle2 className="size-4" />
            {feedback.message}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={saving}>
            {configured ? 'Replace and verify' : 'Save and verify'}
          </Button>
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted transition-colors hover:text-ink"
          >
            Get a key
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </form>

      <p className="mt-6 border-t border-line pt-5 text-xs leading-relaxed text-muted">
        Every transcription, reply and voice clip is billed to your OpenAI account. Fluentia has no
        credits, no markup and no shared key — usage and cost are entirely yours to control.
      </p>
    </Card>
  )
}
