'use client'

import { useActionState, useState } from 'react'
import { AlertCircle, Check } from 'lucide-react'

import { PageHeader, PageShell } from '@/components/shell/page-header'
import { Button } from '@/components/ui/button'
import { LanguageBadge } from '@/components/ui/language-badge'
import { addWorkspace } from '@/lib/actions/workspace'
import { cn } from '@/lib/utils'

type Option = {
  code: string
  name: string
  nativeName: string
  badge: string
  distance: 'close' | 'moderate' | 'far'
}

/** What a Portuguese speaker is walking into, said plainly. */
const DISTANCE_NOTE: Record<Option['distance'], string> = {
  close: 'Próximo do português — você vai reconhecer muita coisa desde o primeiro dia.',
  moderate: 'Alfabeto familiar, ritmo e gramática diferentes.',
  far: 'Outro sistema de escrita. O painel segue em português, então você aprende uma coisa nova de cada vez.',
}

export function NewWorkspaceForm({
  options,
  remaining,
  max,
}: {
  options: Option[]
  remaining: number
  max: number
}) {
  const [state, formAction, pending] = useActionState(addWorkspace, undefined)
  const [language, setLanguage] = useState(options[0]?.code ?? '')

  const chosen = options.find((option) => option.code === language)

  return (
    <PageShell>
      <PageHeader
        eyebrow="Espaços"
        title="Adicionar idioma"
        description={
          <>
            Cada idioma ganha o próprio espaço: nível, erros, vocabulário e metas separados. Sua
            sequência e seu XP ficam na conta, então praticar qualquer um deles mantém a série
            viva. Você pode ter {max} ao mesmo tempo — {remaining}{' '}
            {remaining === 1 ? 'vaga restante' : 'vagas restantes'}.
          </>
        }
      />

      <form action={formAction} className="mt-8">
        <input type="hidden" name="language" value={language} />

        <div className="grid gap-2.5 sm:grid-cols-2">
          {options.map((option) => {
            const selected = option.code === language
            return (
              <button
                key={option.code}
                type="button"
                onClick={() => setLanguage(option.code)}
                aria-pressed={selected}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-xl border p-4 text-left transition-all duration-200',
                  selected
                    ? 'border-brand-500 bg-brand-500/6'
                    : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2',
                )}
              >
                <LanguageBadge code={option.badge} size="lg" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {option.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[0.8125rem] text-muted">
                    {option.nativeName}
                  </span>
                </span>
                {selected && (
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
                    <Check className="size-2.5" strokeWidth={3} />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {chosen && (
          <p className="mt-4 rounded-control border border-line bg-surface-2 px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-muted">
            {DISTANCE_NOTE[chosen.distance]}
          </p>
        )}

        {state?.error && (
          <p className="mt-4 flex items-start gap-2 text-[0.8125rem] font-medium text-rose">
            <AlertCircle className="mt-px size-4 shrink-0" />
            {state.error}
          </p>
        )}

        <Button type="submit" size="lg" loading={pending} className="mt-6" disabled={!language}>
          {chosen ? `Começar a aprender ${chosen.name}` : 'Escolha um idioma'}
        </Button>
      </form>
    </PageShell>
  )
}
