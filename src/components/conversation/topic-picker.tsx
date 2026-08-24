'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Coffee,
  Cpu,
  GraduationCap,
  KeyRound,
  Plane,
  Sparkles,
  TrendingUp,
  Wand2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/field'
import { startConversation } from '@/lib/actions/conversation'
import { ENGLISH_LEVELS } from '@/lib/db/schema'
import { TOPIC_CATEGORIES, TOPICS } from '@/lib/domain/topics'
import { cn, LEVEL_LABELS } from '@/lib/utils'

const ICONS: Record<string, typeof Briefcase> = {
  briefcase: Briefcase,
  graduation: GraduationCap,
  plane: Plane,
  coffee: Coffee,
  cpu: Cpu,
  trending: TrendingUp,
}

export function TopicPicker({
  defaultLevel,
  hasApiKey,
  suggestion,
}: {
  defaultLevel: string
  hasApiKey: boolean
  suggestion?: { topicId: string; reason: string } | null
}) {
  const [state, formAction, pending] = useActionState(startConversation, undefined)
  const [category, setCategory] = useState(TOPIC_CATEGORIES[0].id)
  const [topicId, setTopicId] = useState<string | null>(suggestion?.topicId ?? null)
  const [custom, setCustom] = useState('')
  const [level, setLevel] = useState(defaultLevel)
  const [mode, setMode] = useState<'catalogue' | 'custom'>('catalogue')

  const topics = TOPICS.filter((topic) => topic.category === category)
  const ready = mode === 'catalogue' ? Boolean(topicId) : custom.trim().length >= 3

  if (!hasApiKey) {
    return (
      <div className="rounded-card border border-line bg-surface p-8 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400">
          <KeyRound className="size-5" />
        </span>
        <h2 className="mt-4 text-[1.0625rem] font-semibold text-ink">
          Add your OpenAI key to start speaking
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[0.875rem] leading-relaxed text-muted">
          Fluentia runs on your own OpenAI account, so transcription, replies and the teacher&rsquo;s
          voice are billed directly to you. It takes about a minute to set up.
        </p>
        <Link
          href="/settings"
          className="mt-6 inline-flex items-center gap-2 rounded-pill bg-brand-500 px-4 py-2 text-[0.875rem] font-medium text-white transition-colors hover:bg-brand-600"
        >
          Open AI configuration
          <ArrowRight className="size-4" />
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="level" value={level} />
      <input type="hidden" name="topicId" value={mode === 'catalogue' ? (topicId ?? '') : ''} />
      <input type="hidden" name="customBrief" value={mode === 'custom' ? custom.trim() : ''} />
      <input type="hidden" name="tzOffset" value={new Date().getTimezoneOffset()} />

      {suggestion && mode === 'catalogue' && (
        <div className="flex items-start gap-3 rounded-card border border-brand-500/25 bg-brand-500/6 p-4">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-400" />
          <p className="text-[0.8125rem] leading-relaxed text-ink-soft">
            <span className="font-semibold text-ink">Recommended for you. </span>
            {suggestion.reason}
          </p>
        </div>
      )}

      {/* Mode switch */}
      <div className="flex gap-1 rounded-pill border border-line bg-surface-2 p-1">
        {(
          [
            { id: 'catalogue', label: 'Choose a topic' },
            { id: 'custom', label: 'Create your own' },
          ] as const
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setMode(option.id)}
            className={cn(
              'flex-1 rounded-pill px-4 py-2 text-[0.8125rem] font-medium transition-colors',
              mode === option.id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {mode === 'catalogue' ? (
        <div className="space-y-5">
          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-1 scroll-slim">
            {TOPIC_CATEGORIES.map((item) => {
              const Icon = ICONS[item.icon] ?? Briefcase
              const active = category === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCategory(item.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-pill border px-3.5 py-2 text-[0.8125rem] font-medium transition-all',
                    active
                      ? 'border-brand-500 bg-brand-500/8 text-ink'
                      : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink',
                  )}
                >
                  <Icon
                    className={cn(
                      'size-3.5',
                      active ? 'text-brand-600 dark:text-brand-400' : 'text-faint',
                    )}
                  />
                  {item.label}
                </button>
              )
            })}
          </div>

          {/* Topics */}
          <div className="grid gap-2.5 sm:grid-cols-2">
            {topics.map((topic) => {
              const active = topicId === topic.id
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => setTopicId(topic.id)}
                  aria-pressed={active}
                  className={cn(
                    'rounded-card border p-4 text-left transition-all duration-200',
                    active
                      ? 'border-brand-500 bg-brand-500/6'
                      : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">{topic.label}</span>
                    {active && <ArrowRight className="size-4 text-brand-600 dark:text-brand-400" />}
                  </span>
                  <span className="mt-1.5 block text-[0.8125rem] leading-relaxed text-muted">
                    {topic.brief.split('.')[0]}.
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-card border border-line bg-surface p-5">
          <label
            htmlFor="custom-topic"
            className="flex items-center gap-2 text-sm font-semibold text-ink"
          >
            <Wand2 className="size-4 text-brand-600 dark:text-brand-400" />
            What do you want to talk about?
          </label>
          <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">
            Write it the way you would say it. The teacher builds the session around it.
          </p>
          <Textarea
            id="custom-topic"
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            maxLength={300}
            placeholder="I want to talk about artificial intelligence and whether it will change my job."
            className="mt-4"
          />
          <p className="mt-2 text-right text-xs text-faint">{custom.length}/300</p>
        </div>
      )}

      {/* Level */}
      <div>
        <p className="mb-2.5 text-[0.75rem] font-medium text-muted">
          Difficulty for this session
        </p>
        <div className="flex flex-wrap gap-2">
          {ENGLISH_LEVELS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setLevel(value)}
              aria-pressed={level === value}
              className={cn(
                'rounded-pill border px-3.5 py-2 text-[0.8125rem] font-medium transition-all',
                level === value
                  ? 'border-brand-500 bg-brand-500/8 text-ink'
                  : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink',
              )}
            >
              {LEVEL_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      {state?.errors?.form && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-rose/25 bg-rose/8 px-3.5 py-3 text-[0.8125rem] font-medium text-rose"
        >
          <AlertCircle className="mt-px size-4 shrink-0" />
          {state.errors.form}
        </p>
      )}

      <div className="sticky bottom-4 flex justify-center lg:static lg:justify-start">
        <Button type="submit" size="lg" loading={pending} disabled={!ready}>
          {pending ? 'Getting your teacher ready…' : 'Start speaking'}
          {!pending && <ArrowRight className="size-4" />}
        </Button>
      </div>
    </form>
  )
}
