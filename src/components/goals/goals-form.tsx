'use client'

import { useActionState } from 'react'
import { CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/field'
import { Progress } from '@/components/ui/misc'
import { updateGoals } from '@/lib/actions/profile'
import { GOAL_KINDS } from '@/lib/db/schema'
import { cn } from '@/lib/utils'

const META: Record<string, { label: string; unit: string; hint: string }> = {
  weekly_sessions: {
    label: 'Conversas',
    unit: 'sessões',
    hint: 'Conversas concluídas nesta semana',
  },
  weekly_minutes: { label: 'Minutos falando', unit: 'minutes', hint: 'Tempo de fato falando' },
  weekly_words: { label: 'Palavras novas', unit: 'palavras', hint: 'Palavras adicionadas ao seu vocabulário' },
  weekly_mistakes: {
    label: 'Erros revisados',
    unit: 'erros',
    hint: 'Padrões que apareceram e receberam atenção',
  },
}

export function GoalsForm({
  targets,
  progress,
}: {
  targets: Record<string, number>
  progress: Record<string, number>
}) {
  const [state, formAction, pending] = useActionState(updateGoals, undefined)

  return (
    <Card>
      <CardHeader
        title="Metas semanais"
        hint="Coloque 0 para desligar uma meta. O progresso zera toda segunda e é medido pelas suas sessões reais."
      />

      <form action={formAction} className="space-y-6">
        {GOAL_KINDS.map((kind) => {
          const meta = META[kind]
          const target = targets[kind] ?? 0
          const current = progress[kind] ?? 0
          const done = target > 0 && current >= target

          return (
            <div key={kind}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <label
                    htmlFor={`goal-${kind}`}
                    className="text-[0.875rem] font-semibold text-ink"
                  >
                    {meta.label}
                  </label>
                  <p className="mt-0.5 text-[0.8125rem] text-muted">{meta.hint}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-[0.8125rem] font-semibold tabular-nums',
                      done ? 'text-brand-600 dark:text-brand-400' : 'text-muted',
                    )}
                  >
                    {current} /
                  </span>
                  <Input
                    id={`goal-${kind}`}
                    name={kind}
                    type="number"
                    min={0}
                    max={1000}
                    defaultValue={target}
                    className="w-20 text-center tabular-nums"
                  />
                  <span className="w-16 text-[0.8125rem] text-muted">{meta.unit}</span>
                </div>
              </div>

              {target > 0 && (
                <Progress
                  value={current}
                  total={target}
                  tone={done ? 'accent' : 'neutral'}
                  className="mt-3"
                  label={meta.label}
                />
              )}
            </div>
          )
        })}

        {state?.ok && (
          <p className="flex items-center gap-2 text-[0.8125rem] font-medium text-brand-600 dark:text-brand-400">
            <CheckCircle2 className="size-4" />
            Metas atualizadas.
          </p>
        )}

        <Button type="submit" variant="secondary" loading={pending}>
          Salvar metas
        </Button>
      </form>
    </Card>
  )
}
