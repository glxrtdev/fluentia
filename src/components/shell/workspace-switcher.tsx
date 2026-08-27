'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react'

import { switchToWorkspace } from '@/lib/actions/workspace'
import { LanguageBadge } from '@/components/ui/language-badge'
import { getLanguage } from '@/lib/languages'
import { cn } from '@/lib/utils'

export type WorkspaceSummary = {
  id: string
  language: string
  level: string
}

/**
 * Which language you are working in, and how to change it.
 *
 * Sits above the navigation rather than inside settings, because everything
 * below it — sessions, mistakes, vocabulary, goals — belongs to whichever
 * language is picked here. Being able to see that at a glance is the point.
 */
export function WorkspaceSwitcher({
  workspaces,
  activeId,
  canAdd,
  className,
}: {
  workspaces: WorkspaceSummary[]
  activeId: string
  canAdd: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const rootRef = useRef<HTMLDivElement>(null)

  const active = workspaces.find((workspace) => workspace.id === activeId) ?? workspaces[0]

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!active) return null
  const current = getLanguage(active.language)

  const choose = (id: string) => {
    setOpen(false)
    if (id === active.id) return
    startTransition(() => void switchToWorkspace(id))
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={pending}
        className={cn(
          'flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2 text-left',
          'transition-colors hover:border-line-strong disabled:opacity-60 lg:min-h-0',
        )}
      >
        <LanguageBadge code={current.badge} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.8125rem] font-semibold text-ink">
            {current.name.pt}
          </span>
          <span className="block truncate text-[0.6875rem] text-faint">{current.nativeName}</span>
        </span>
        {pending ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-faint" />
        ) : (
          <ChevronsUpDown className="size-3.5 shrink-0 text-faint" />
        )}
      </button>

      {open && (
        <ul
          role="listbox"
          className={cn(
            'absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-line',
            'bg-surface p-1 shadow-[var(--shadow-lift)] animate-fade-in',
          )}
        >
          {workspaces.map((workspace) => {
            const language = getLanguage(workspace.language)
            const selected = workspace.id === active.id
            return (
              <li key={workspace.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => choose(workspace.id)}
                  className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-2 lg:min-h-0"
                >
                  <LanguageBadge code={language.badge} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink-soft">
                    {language.name.pt}
                  </span>
                  {selected && (
                    <Check className="size-3.5 shrink-0 text-brand-600 dark:text-brand-400" />
                  )}
                </button>
              </li>
            )
          })}

          {canAdd && (
            <li className="mt-1 border-t border-line pt-1">
              <Link
                href="/workspaces/new"
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8125rem] text-muted transition-colors hover:bg-surface-2 hover:text-ink lg:min-h-0"
              >
                <Plus className="size-3.5 shrink-0" />
                Adicionar idioma
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
