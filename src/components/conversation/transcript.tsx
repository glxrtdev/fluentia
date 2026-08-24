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
          'transition-colors hover:bg-rose/10',
          isActive ? 'bg-rose/15 text-ink' : 'text-ink',
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
        className="min-h-0 flex-1 space-y-5 overflow-y-auto px-1 py-2 scroll-slim"
      >
        {messages.map((message) => (
          <div key={message.id} className="animate-fade-in">
            <p className="mb-1 text-[0.75rem] font-medium text-faint">
              {message.role === 'assistant' ? 'Teacher' : 'You'}
            </p>
            <p
              className={cn(
                'text-[0.9375rem] leading-relaxed',
                message.role === 'assistant' ? 'text-ink' : 'text-ink-soft',
              )}
            >
              {message.role === 'user' ? (
                <Marked
                  content={message.content}
                  corrections={byMessage.get(message.id) ?? []}
                  activeId={activeCorrectionId}
                  onSelect={onSelectCorrection}
                />
              ) : (
                message.content
              )}
            </p>
          </div>
        ))}

        {thinking && (
          <p className="flex items-center gap-2 text-[0.8125rem] text-muted">
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
