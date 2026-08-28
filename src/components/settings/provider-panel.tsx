'use client'

import { useState, useTransition } from 'react'
import { AlertCircle, Check } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { setAiProvider } from '@/lib/actions/ai'
import { PROVIDERS, PROVIDER_IDS, type ProviderId } from '@/lib/ai/provider'
import { cn } from '@/lib/utils'

/**
 * Which AI runs the conversation.
 *
 * Only providers that can hear, think and speak on their own appear here. That
 * rule is why Claude is absent: it reasons well and supports structured
 * output, but its API takes text, images and PDFs and returns text — no
 * transcription, no speech. Offering it would mean a learner needed a second
 * account to finish one conversation.
 */
export function ProviderPanel({ current }: { current: ProviderId }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ProviderId>(current)

  const choose = (id: ProviderId) => {
    if (id === selected) return
    setSelected(id)
    setError(null)
    startTransition(async () => {
      const result = await setAiProvider(id)
      if (result?.errors?.form) {
        setError(result.errors.form)
        setSelected(current)
      }
    })
  }

  return (
    <Card>
      <h2 className="text-[0.9375rem] font-semibold text-ink">Provedor de IA</h2>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">
        Quem escuta, ensina e fala. Só aparecem aqui provedores que fazem os três sozinhos — você
        nunca precisa de duas contas para uma conversa.
      </p>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {PROVIDER_IDS.map((id) => {
          const provider = PROVIDERS[id]
          const active = selected === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => choose(id)}
              disabled={pending}
              aria-pressed={active}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-control border p-3.5 text-left transition-colors',
                'disabled:opacity-60',
                active
                  ? 'border-brand-500 bg-brand-500/6'
                  : 'border-line hover:border-line-strong hover:bg-surface-2',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.875rem] font-semibold text-ink">
                  {provider.label}
                </span>
                <span className="mt-0.5 block truncate text-[0.75rem] text-muted">
                  {provider.defaults.chat}
                </span>
              </span>
              {active && (
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
                  <Check className="size-2.5" strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-2 text-[0.8125rem] font-medium text-rose">
          <AlertCircle className="mt-px size-4 shrink-0" />
          {error}
        </p>
      )}

      <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-faint">
        Trocar de provedor limpa os modelos e a voz escolhidos, porque cada provedor tem os seus. A
        chave do outro provedor continua salva — você não precisa colar de novo se voltar.
      </p>
    </Card>
  )
}
