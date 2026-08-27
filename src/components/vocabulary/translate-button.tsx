'use client'

import { useState } from 'react'
import { Languages, Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Translation is explicit: it costs the learner an OpenAI call, so it happens
 * only when they ask for it.
 */
export function TranslateButton({
  word,
  definition,
  vocabularyId,
  initial,
  compact = false,
}: {
  word: string
  definition: string
  vocabularyId?: string
  initial?: string | null
  compact?: boolean
}) {
  const [translation, setTranslation] = useState(initial ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const translate = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ word, definition, vocabularyId: vocabularyId ?? null }),
      })
      const data = await response.json()
      if (!response.ok) setError(data?.error ?? 'Translation failed.')
      else setTranslation(data.translation)
    } catch {
      setError('Translation failed.')
    } finally {
      setLoading(false)
    }
  }

  if (translation) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-[0.8125rem] text-muted',
          compact && 'text-xs',
        )}
      >
        <Languages className="size-3.5 shrink-0 text-faint" />
        <span className="font-medium text-ink-soft">{translation}</span>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={translate}
        disabled={loading}
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-pill border border-line px-2.5 py-1 text-[0.6875rem] font-semibold text-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-60',
        )}
      >
        {loading ? <Loader2 className="size-3 animate-spin" /> : <Languages className="size-3" />}
        Traduzir
      </button>
      {error && <span className="text-[0.6875rem] font-medium text-rose">{error}</span>}
    </span>
  )
}
