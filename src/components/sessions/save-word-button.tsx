'use client'

import { useState, useTransition } from 'react'
import { BookmarkPlus, Check } from 'lucide-react'

import { addWord } from '@/lib/actions/vocabulary'
import { cn } from '@/lib/utils'

/** Saves a word or expression the session report surfaced. */
export function SaveWordButton({
  word,
  definition,
  label = 'Save',
}: {
  word: string
  definition: string
  label?: string
}) {
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={saved || pending}
      onClick={() =>
        startTransition(async () => {
          await addWord({ word, definition, source: 'conversation' })
          setSaved(true)
        })
      }
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[0.6875rem] font-semibold transition-colors',
        saved
          ? 'border-brand-500/30 bg-brand-500/8 text-brand-700 dark:text-brand-300'
          : 'border-line text-muted hover:border-line-strong hover:text-ink',
        pending && 'opacity-60',
      )}
    >
      {saved ? <Check className="size-3" /> : <BookmarkPlus className="size-3" />}
      {saved ? 'Saved' : label}
    </button>
  )
}
