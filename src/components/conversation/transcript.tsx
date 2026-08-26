'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowDown, Loader2 } from 'lucide-react'

import type { LiveCorrection } from '@/components/conversation/feedback-panel'
import { locateMarks } from '@/lib/transcript-marks'
import { cn } from '@/lib/utils'

export type TranscriptMessage = { id: string; role: 'user' | 'assistant'; content: string }

function Marked({
  content,
  corrections,
  activeId,
  onSelect,
}: {
  content: string
  corrections: LiveCorrection[]
  activeId: string | null
  onSelect: (id: string) => void
}) {
  const spans = locateMarks(content, corrections)
  if (spans.length === 0) return <>{content}</>

  const parts: React.ReactNode[] = []
  let cursor = 0

  for (const span of spans) {
    if (span.start > cursor) parts.push(content.slice(cursor, span.start))

    const isActive = activeId === span.item.id
    parts.push(
      <button
        key={span.item.id}
        type="button"
        onClick={() => onSelect(span.item.id)}
        title={`${span.item.original} → ${span.item.corrected}`}
        className={cn(
          'rounded-[0.2rem] px-0.5 underline decoration-rose decoration-wavy underline-offset-[3px]',
          'transition-colors hover:bg-rose/15',
          isActive ? 'bg-rose/20 text-ink' : 'text-ink',
        )}
      >
        {content.slice(span.start, span.end)}
      </button>,
    )
    cursor = span.end
  }

  if (cursor < content.length) parts.push(content.slice(cursor))
  return <>{parts}</>
}

export function Transcript({
  messages,
  corrections,
  thinking,
  activeCorrectionId,
  onSelectCorrection,
}: {
  messages: TranscriptMessage[]
  corrections: LiveCorrection[]
  thinking: boolean
  activeCorrectionId: string | null
  onSelectCorrection: (id: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)

  const scrollToEnd = (behavior: ScrollBehavior = 'smooth') => {
    const node = scrollRef.current
    if (node) node.scrollTo({ top: node.scrollHeight, behavior })
  }

  /* Track whether the learner has scrolled up to re-read something. */
  useEffect(() => {
    const node = scrollRef.current
    if (!node) return

    const onScroll = () => {
      const distance = node.scrollHeight - node.scrollTop - node.clientHeight
      setAtBottom(distance < 80)
    }
    node.addEventListener('scroll', onScroll, { passive: true })
    return () => node.removeEventListener('scroll', onScroll)
  }, [])

  /*
   * Follow the conversation only while they are already at the bottom — yanking
   * the view down while someone is reading an earlier turn is worse than
   * missing the newest line.
   */
  useLayoutEffect(() => {
    if (atBottom) scrollToEnd(messages.length > 2 ? 'smooth' : 'auto')
    // `atBottom` is deliberately not a dependency: only new content scrolls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, thinking])

  const byMessage = new Map<string, LiveCorrection[]>()
  for (const correction of corrections) {
    if (!correction.messageId) continue
    byMessage.set(correction.messageId, [...(byMessage.get(correction.messageId) ?? []), correction])
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-2 scroll-slim"
      >
        {messages.map((message) => {
          const mine = message.role === 'user'

          return (
            <div
              key={message.id}
              className={cn('flex animate-fade-in flex-col', mine ? 'items-end' : 'items-start')}
            >
              <p
                className={cn(
                  'mb-1 px-1 text-[0.75rem] font-medium',
                  mine ? 'text-brand-600 dark:text-brand-400' : 'text-faint',
                )}
              >
                {mine ? 'You' : 'Teacher'}
              </p>

              {/*
                Your own turn is tinted with the brand accent rather than filled
                with it: the wavy rose marks that show where you slipped have to
                stay readable on top, and they do not survive a solid iris.
              */}
              <div
                className={cn(
                  'max-w-[88%] rounded-2xl border px-3.5 py-2.5 text-[0.9375rem] leading-relaxed sm:max-w-[80%]',
                  mine
                    ? 'rounded-br-md border-brand-500/30 bg-brand-500/12 text-ink dark:bg-brand-500/20'
                    : 'rounded-bl-md border-line bg-surface-2 text-ink',
                )}
              >
                {mine ? (
                  <Marked
                    content={message.content}
                    corrections={byMessage.get(message.id) ?? []}
                    activeId={activeCorrectionId}
                    onSelect={onSelectCorrection}
                  />
                ) : (
                  message.content
                )}
              </div>
            </div>
          )
        })}

        {thinking && (
          <p className="flex items-center gap-2 px-1 text-[0.8125rem] text-muted">
            <Loader2 className="size-3.5 animate-spin" />
            Transcribing and thinking…
          </p>
        )}
      </div>

      {!atBottom && (
        <button
          type="button"
          onClick={() => scrollToEnd()}
          className={cn(
            'absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-pill',
            'border border-line bg-surface px-3 py-1.5 text-[0.75rem] font-medium text-muted',
            'shadow-[var(--shadow-lift)] transition-colors hover:text-ink animate-fade-in',
          )}
        >
          <ArrowDown className="size-3" />
          Jump to latest
        </button>
      )}
    </div>
  )
}
