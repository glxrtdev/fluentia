'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { AlertCircle, Plus, Trash2 } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { LanguageBadge } from '@/components/ui/language-badge'
import { removeWorkspace } from '@/lib/actions/workspace'
import { getLanguage } from '@/lib/languages'
import { cn } from '@/lib/utils'

type Space = { id: string; language: string; sessions: number; words: number }

/**
 * The languages on this account, and the language the app itself speaks.
 *
 * They are deliberately next to each other but clearly separate: people
 * conflate "I am learning Japanese" with "show me Japanese menus", and the
 * whole point of the second control is that it is the learner's own language.
 */
export function WorkspacePanel({
  spaces,
  activeId,
  canAdd,
  max,
}: {
  spaces: Space[]
  activeId: string
  canAdd: boolean
  max: number
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  const remove = (id: string) => {
    setError(null)
    startTransition(async () => {
      const result = await removeWorkspace(id)
      if (result?.error) setError(result.error)
      setConfirming(null)
    })
  }

  return (
    <Card>
      <h2 className="text-[0.9375rem] font-semibold text-ink">Seus idiomas</h2>

      <ul className="mt-4 space-y-2">
        {spaces.map((space) => {
          const language = getLanguage(space.language)
          const active = space.id === activeId
          return (
            <li
              key={space.id}
              className={cn(
                'flex items-center gap-3 rounded-control border px-3.5 py-3',
                active ? 'border-brand-500/40 bg-brand-500/6' : 'border-line',
              )}
            >
              <LanguageBadge code={language.badge} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.875rem] font-medium text-ink">{language.name.pt}</p>
                <p className="truncate text-[0.75rem] text-muted">
                  {space.sessions} sessões · {space.words} palavras
                </p>
              </div>

              {confirming === space.id ? (
                <span className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => remove(space.id)}
                    disabled={pending}
                    className="rounded-pill bg-rose px-3 py-1.5 text-[0.75rem] font-medium text-white disabled:opacity-60"
                  >
                    Excluir
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="rounded-pill px-2 py-1.5 text-[0.75rem] text-muted"
                  >
                    Cancelar
                  </button>
                </span>
              ) : (
                spaces.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setConfirming(space.id)}
                    aria-label={`Remover ${language.name.pt}`}
                    className="flex size-9 shrink-0 items-center justify-center rounded-control text-faint transition-colors hover:text-rose"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )
              )}
            </li>
          )
        })}
      </ul>

      {error && (
        <p className="mt-3 flex items-start gap-2 text-[0.8125rem] font-medium text-rose">
          <AlertCircle className="mt-px size-4 shrink-0" />
          {error}
        </p>
      )}

      {canAdd ? (
        <Link
          href="/workspaces/new"
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-control border border-line px-3.5 text-[0.8125rem] font-medium text-muted transition-colors hover:border-line-strong hover:text-ink lg:min-h-9"
        >
          <Plus className="size-3.5" />
          Adicionar idioma
        </Link>
      ) : (
        <p className="mt-3 text-[0.75rem] text-faint">
          {max} / {max}
        </p>
      )}

    </Card>
  )
}
