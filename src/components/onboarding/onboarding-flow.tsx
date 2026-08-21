'use client'

import { useActionState, useState } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'

import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { completeOnboarding } from '@/lib/actions/profile'
import { ENGLISH_LEVELS, MAIN_GOALS } from '@/lib/db/schema'
import { cn, LEVEL_LABELS } from '@/lib/utils'

const LEVEL_HINTS: Record<string, string> = {
  beginner: 'I know some words but I freeze when I speak.',
  elementary: 'I manage simple sentences about familiar things.',
  intermediate: 'I hold a conversation but I make mistakes.',
  'upper-intermediate': 'I speak comfortably; I want precision and fluency.',
  advanced: 'I am fluent; I want nuance and natural phrasing.',
}

const GOAL_LABELS: Record<string, { label: string; hint: string }> = {
  travel: { label: 'Travel', hint: 'Airports, hotels, getting around' },
  career: { label: 'Career', hint: 'Work, meetings, promotions' },
  studies: { label: 'Studies', hint: 'University, exams, research' },
  interviews: { label: 'Interviews', hint: 'Land the job you want' },
  'daily-conversation': { label: 'Daily conversation', hint: 'Talk about anything, easily' },
  fluency: { label: 'Fluency', hint: 'Speak without translating in my head' },
}

const MINUTES = [10, 20, 30, 60]

const INTEREST_SUGGESTIONS = [
  'technology',
  'football',
  'cooking',
  'travel',
  'music',
  'startups',
  'films',
  'fitness',
  'books',
  'gaming',
  'design',
  'science',
]

function Option({
  selected,
  onClick,
  title,
  hint,
}: {
  selected: boolean
  onClick: () => void
  title: string
  hint?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-all duration-200',
        selected
          ? 'border-brand-500 bg-brand-500/6 shadow-[0_0_0_3px_var(--brand-500)]/10'
          : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors',
          selected ? 'border-brand-500 bg-brand-500 text-white' : 'border-line-strong',
        )}
      >
        {selected && <Check className="size-2.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        {hint && <span className="mt-0.5 block text-[0.8125rem] leading-relaxed text-muted">{hint}</span>}
      </span>
    </button>
  )
}

export function OnboardingFlow({ name }: { name: string }) {
  const [state, formAction, pending] = useActionState(completeOnboarding, undefined)
  const [step, setStep] = useState(0)
  const [level, setLevel] = useState<string>('intermediate')
  const [goal, setGoal] = useState<string>('fluency')
  const [minutes, setMinutes] = useState(20)
  const [interests, setInterests] = useState<string[]>([])

  const steps = [
    { title: `Welcome, ${name.split(' ')[0]}`, subtitle: 'How would you describe your English today?' },
    { title: 'What is this for?', subtitle: 'Your main goal shapes the topics we suggest.' },
    { title: 'How much time?', subtitle: 'A realistic daily target beats an ambitious one.' },
    { title: 'What do you enjoy?', subtitle: 'Optional — the teacher weaves these into conversations.' },
  ]

  const toggleInterest = (value: string) =>
    setInterests((current) =>
      current.includes(value)
        ? current.filter((i) => i !== value)
        : current.length < 8
          ? [...current, value]
          : current,
    )

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-8 sm:px-6">
      <Logo />

      <div className="mt-10 flex gap-1.5" aria-hidden>
        {steps.map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-1 flex-1 rounded-pill transition-colors duration-300',
              i <= step ? 'bg-brand-500' : 'bg-line',
            )}
          />
        ))}
      </div>

      <form action={formAction} className="flex flex-1 flex-col">
        {/* Everything the wizard collected travels with the final submit. */}
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="level" value={level} />
        <input type="hidden" name="mainGoal" value={goal} />
        <input type="hidden" name="dailyMinutesGoal" value={minutes} />
        <input type="hidden" name="interests" value={interests.join(',')} />
        <input type="hidden" name="autoAdaptLevel" value="true" />
        <input type="hidden" name="nativeLanguage" value="pt-BR" />

        <div key={step} className="mt-9 flex-1 animate-fade-up">
          <h1 className="display text-[2rem] leading-tight text-ink">{steps[step].title}</h1>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{steps[step].subtitle}</p>

          <div className="mt-7 space-y-2.5">
            {step === 0 &&
              ENGLISH_LEVELS.map((value) => (
                <Option
                  key={value}
                  selected={level === value}
                  onClick={() => setLevel(value)}
                  title={LEVEL_LABELS[value]}
                  hint={LEVEL_HINTS[value]}
                />
              ))}

            {step === 1 &&
              MAIN_GOALS.map((value) => (
                <Option
                  key={value}
                  selected={goal === value}
                  onClick={() => setGoal(value)}
                  title={GOAL_LABELS[value].label}
                  hint={GOAL_LABELS[value].hint}
                />
              ))}

            {step === 2 && (
              <div className="grid grid-cols-2 gap-2.5">
                {MINUTES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMinutes(value)}
                    aria-pressed={minutes === value}
                    className={cn(
                      'rounded-xl border p-5 text-center transition-all',
                      minutes === value
                        ? 'border-brand-500 bg-brand-500/6'
                        : 'border-line bg-surface hover:border-line-strong',
                    )}
                  >
                    <span className="display block text-3xl text-ink">{value}</span>
                    <span className="mt-1 block text-xs font-medium text-muted">
                      minutes a day
                    </span>
                  </button>
                ))}
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-wrap gap-2">
                {INTEREST_SUGGESTIONS.map((value) => {
                  const selected = interests.includes(value)
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleInterest(value)}
                      aria-pressed={selected}
                      className={cn(
                        'rounded-pill border px-3.5 py-2 text-[0.8125rem] font-medium transition-all',
                        selected
                          ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300'
                          : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink',
                      )}
                    >
                      {value}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {state?.errors?.form && (
            <p role="alert" className="mt-5 text-[0.8125rem] font-medium text-rose">
              {state.errors.form}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 bg-canvas py-6">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>

          {step < steps.length - 1 ? (
            <Button type="button" onClick={() => setStep((s) => s + 1)}>
              Continue
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button type="submit" loading={pending}>
              Enter Fluentia
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
