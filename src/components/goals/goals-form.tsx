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
    label: 'Speaking sessions',
    unit: 'sessions',
    hint: 'Conversations finished this week',
  },
  weekly_minutes: { label: 'Minutes speaking', unit: 'minutes', hint: 'Time actually spent talking' },
  weekly_words: { label: 'New words', unit: 'words', hint: 'Words added to your vocabulary' },
  weekly_mistakes: {
    label: 'Mistakes reviewed',
    unit: 'mistakes',
    hint: 'Patterns that came up and got attention',
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
        title="Weekly goals"
        hint="Set 0 to switch a goal off. Progress resets every Monday and is measured from your real sessions."
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
                  tone={done ? 'brand' : 'iris'}
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
            Goals updated.
          </p>
        )}

        <Button type="submit" variant="secondary" loading={pending}>
          Save goals
        </Button>
      </form>
    </Card>
  )
}
