'use client'

import { Lightbulb, Sparkles } from 'lucide-react'

import { CATEGORY_LABELS, cn } from '@/lib/utils'

export type LiveCorrection = {
  id: string
  category: string
  original: string
  corrected: string
  explanation: string | null
  betterSentence: string | null
  severity: number
}

const TONE: Record<string, string> = {
  grammar: 'text-rose',
  prepositions: 'text-brand-600 dark:text-brand-400',
  vocabulary: 'text-brand-600 dark:text-brand-400',
  pronunciation: 'text-brand-600 dark:text-brand-400',
  'sentence-structure': 'text-rose',
  naturalness: 'text-brand-600 dark:text-brand-400',
}

export function CorrectionCard({ correction }: { correction: LiveCorrection }) {
  return (
    <article className="animate-fade-up rounded-xl border border-line bg-surface p-4">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span
          className={cn(
            'text-[0.75rem] font-medium',
            TONE[correction.category] ?? 'text-muted',
          )}
        >
          {CATEGORY_LABELS[correction.category] ?? correction.category}
        </span>
        {correction.severity >= 3 && (
          <span className="rounded-pill bg-rose/10 px-2 py-0.5 text-[0.75rem] font-medium text-rose">
            Key
          </span>
        )}
      </div>

      <p className="text-[0.9375rem] leading-relaxed">
        <span className="text-muted line-through decoration-rose/50 decoration-2">
          {correction.original}
        </span>
        <span className="mx-2 text-faint">→</span>
        <span className="font-semibold text-brand-600 dark:text-brand-400">
          {correction.corrected}
        </span>
      </p>

      {correction.explanation && (
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">{correction.explanation}</p>
      )}

      {correction.betterSentence && (
        <p className="mt-3 flex gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-[0.8125rem] leading-relaxed text-ink-soft">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-brand-500" />
          <span>
            <span className="font-semibold text-ink">Better: </span>
            {correction.betterSentence}
          </span>
        </p>
      )}
    </article>
  )
}

export function FeedbackPanel({ corrections }: { corrections: LiveCorrection[] }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="text-[0.75rem] font-medium text-muted">
          Feedback
        </h2>
        {corrections.length > 0 && (
          <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-[0.6875rem] font-semibold text-muted">
            {corrections.length}
          </span>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 scroll-slim">
        {corrections.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <Lightbulb className="size-5 text-faint" />
            <p className="mt-3 text-[0.8125rem] font-medium text-ink">Nothing to fix yet</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Corrections show up here as you speak. Only the ones worth your attention — the
              teacher never reads them out loud.
            </p>
          </div>
        ) : (
          [...corrections]
            .reverse()
            .map((correction) => <CorrectionCard key={correction.id} correction={correction} />)
        )}
      </div>
    </div>
  )
}
