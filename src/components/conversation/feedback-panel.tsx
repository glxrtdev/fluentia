'use client'

import { useEffect } from 'react'
import { Lightbulb, Sparkles } from 'lucide-react'

import { diffCorrection } from '@/lib/corrections/diff'
import { CATEGORY_LABELS, cn } from '@/lib/utils'

export type LiveCorrection = {
  id: string
  /** Which of the learner's turns this belongs to, so it can be marked in place. */
  messageId: string | null
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

export function CorrectionCard({
  correction,
  active,
  onSelect,
}: {
  correction: LiveCorrection
  active?: boolean
  onSelect?: (id: string) => void
}) {
  const diff = diffCorrection(correction.original, correction.corrected)

  return (
    <article
      id={`correction-${correction.id}`}
      onClick={() => onSelect?.(correction.id)}
      className={cn(
        "animate-fade-up rounded-control border bg-surface p-4 transition-colors",
        onSelect && "cursor-pointer",
        active ? "border-rose/50 bg-rose/5" : "border-line hover:border-line-strong",
      )}
    >
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

      {/*
        Only the words that actually changed are struck through or highlighted.
        Striking a whole clause to fix three words of it buries the lesson.
      */}
      <p className="text-[0.9375rem] leading-relaxed">
        <span className="text-muted">
          {diff.original.map((piece, index) =>
            piece.changed ? (
              <span key={index} className="line-through decoration-rose/60 decoration-2">
                {piece.text}
              </span>
            ) : (
              <span key={index}>{piece.text}</span>
            ),
          )}
        </span>
        <span className="mx-2 text-faint">→</span>
        <span className="text-muted">
          {diff.corrected.map((piece, index) =>
            piece.changed ? (
              <span key={index} className="font-semibold text-brand-600 dark:text-brand-400">
                {piece.text}
              </span>
            ) : (
              <span key={index}>{piece.text}</span>
            ),
          )}
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

export function FeedbackPanel({
  corrections,
  activeId,
  onSelect,
}: {
  corrections: LiveCorrection[]
  activeId?: string | null
  onSelect?: (id: string) => void
}) {
  /* Clicking an underlined mistake up in the transcript brings its card here. */
  useEffect(() => {
    if (!activeId) return
    document
      .getElementById(`correction-${activeId}`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeId])

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
              Corrections show up here as you speak, and the words they refer to get underlined in
              your own sentence above.
            </p>
          </div>
        ) : (
          [...corrections]
            .reverse()
            .map((correction) => (
              <CorrectionCard
                key={correction.id}
                correction={correction}
                active={activeId === correction.id}
                onSelect={onSelect}
              />
            ))
        )}
      </div>
    </div>
  )
}
