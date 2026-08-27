'use client'

import { useActionState, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import { updateProfile } from '@/lib/actions/profile'
import { ENGLISH_LEVELS, MAIN_GOALS } from '@/lib/db/schema'
import type { SelectOption } from '@/components/ui/select'
import { cn, LEVEL_LABELS } from '@/lib/utils'

const LEVEL_HINTS: Record<string, string> = {
  beginner: 'I know some words but I freeze when I speak.',
  elementary: 'I manage simple sentences about familiar things.',
  intermediate: 'I hold a conversation but I make mistakes.',
  'upper-intermediate': 'I speak comfortably; I want precision.',
  advanced: 'I am fluent; I want nuance and natural phrasing.',
}

const GOAL_LABELS: Record<string, string> = {
  travel: 'Travel',
  career: 'Career',
  studies: 'Studies',
  interviews: 'Interviews',
  'daily-conversation': 'Daily conversation',
  fluency: 'Fluency',
}

const LEVEL_OPTIONS: SelectOption[] = ENGLISH_LEVELS.map((level) => ({
  value: level,
  label: LEVEL_LABELS[level],
  description: LEVEL_HINTS[level],
}))

const GOAL_OPTIONS: SelectOption[] = [
  { value: '', label: 'No specific goal' },
  ...MAIN_GOALS.map((goal) => ({ value: goal, label: GOAL_LABELS[goal] })),
]

const MINUTE_OPTIONS: SelectOption[] = [10, 20, 30, 60].map((minutes) => ({
  value: String(minutes),
  label: `${minutes} minutes`,
  description: minutes <= 10 ? 'Short and easy to keep up' : minutes >= 60 ? 'Serious commitment' : undefined,
}))

const LANGUAGES: SelectOption[] = [
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'pt-PT', label: 'Portuguese (Portugal)' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'other', label: 'Other' },
]

export function LearningPreferences({
  profile,
  name,
}: {
  name: string
  profile: {
    level: string
    autoAdaptLevel: boolean
    mainGoal: string | null
    dailyMinutesGoal: number
    nativeLanguage: string
    interests: string[]
  }
}) {
  const [state, formAction, pending] = useActionState(updateProfile, undefined)
  const [autoAdapt, setAutoAdapt] = useState(profile.autoAdaptLevel)
  const [interests, setInterests] = useState(profile.interests.join(', '))

  return (
    <Card>
      <CardHeader
        title="Preferências de aprendizado"
        hint="These shape every conversation: how hard the teacher speaks, which topics get suggested and what your weekly targets mean."
      />

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="autoAdaptLevel" value={String(autoAdapt)} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome de exibição" error={state?.errors?.name}>
            <Input name="name" defaultValue={name} required />
          </Field>

          <Field label="Idioma nativo" error={state?.errors?.nativeLanguage}>
            <Select
              name="nativeLanguage"
              defaultValue={profile.nativeLanguage}
              options={LANGUAGES}
            />
          </Field>

          <Field label="Seu nível" error={state?.errors?.level}>
            <Select name="level" defaultValue={profile.level} options={LEVEL_OPTIONS} />
          </Field>

          <Field label="Objetivo principal" error={state?.errors?.mainGoal}>
            <Select name='mainGoal' defaultValue={profile.mainGoal ?? ''} options={GOAL_OPTIONS} />
          </Field>

          <Field label="Prática diária" error={state?.errors?.dailyMinutesGoal}>
            <Select
              name="dailyMinutesGoal"
              defaultValue={String(profile.dailyMinutesGoal)}
              options={MINUTE_OPTIONS}
            />
          </Field>

          <Field
            label="Interesses"
            hint="Separados por vírgula. O professor usa isso nos exemplos."
            error={state?.errors?.interests}
          >
            <Input
              name="interests"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              placeholder="startups, futebol, culinária"
            />
          </Field>
        </div>

        <button
          type="button"
          onClick={() => setAutoAdapt((v) => !v)}
          aria-pressed={autoAdapt}
          className="flex w-full items-start gap-3 rounded-xl border border-line bg-surface-2 p-4 text-left transition-colors hover:border-line-strong"
        >
          <span
            className={cn(
              'mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-pill p-0.5 transition-colors',
              autoAdapt ? 'bg-brand-500' : 'bg-line-strong',
            )}
          >
            <span
              className={cn(
                'size-4 rounded-full bg-white transition-transform',
                autoAdapt && 'translate-x-4',
              )}
            />
          </span>
          <span>
            <span className="block text-sm font-semibold text-ink">Ajustar a dificuldade automaticamente</span>
            <span className="mt-0.5 block text-[0.8125rem] leading-relaxed text-muted">
              Depois de cada sessão a Fluentia ajusta seu nível para cima ou para baixo conforme
              você realmente falou, em vez de esperar que você mude.
            </span>
          </span>
        </button>

        {state?.ok && (
          <p className="flex items-center gap-2 text-[0.8125rem] font-medium text-brand-600 dark:text-brand-400">
            <CheckCircle2 className="size-4" />
            Salvo.
          </p>
        )}

        <Button type="submit" variant="secondary" loading={pending}>
          Salvar preferências
        </Button>
      </form>
    </Card>
  )
}
