import type { Metadata } from 'next'
import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { Flame, Settings2, Target, Timer } from 'lucide-react'

import { GoalsForm } from '@/components/goals/goals-form'
import { PageHeader, PageShell } from '@/components/shell/page-header'
import { Card } from '@/components/ui/card'
import { Progress, Stat } from '@/components/ui/misc'
import { getProfile, requireUser, requireWorkspace } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { goals, streaks } from '@/lib/db/schema'
import { weeklyProgress } from '@/lib/domain/recommendations'
import { and } from 'drizzle-orm'
import { formatDuration, localDay, startOfWeek } from '@/lib/utils'

export const metadata: Metadata = { title: 'Metas' }

const MAIN_GOAL_LABELS: Record<string, string> = {
  travel: 'Viagem',
  career: 'Carreira',
  studies: 'Estudos',
  interviews: 'Entrevistas',
  'daily-conversation': 'Conversa do dia a dia',
  fluency: 'Fluência',
}

export default async function GoalsPage() {
  const user = await requireUser()
  const [profile, workspace] = await Promise.all([getProfile(user.id), requireWorkspace(user.id)])

  const today = localDay()
  const [progress, rows, todayRows] = await Promise.all([
    weeklyProgress(workspace.id, startOfWeek(today)),
    db.select().from(goals).where(eq(goals.workspaceId, workspace.id)),
    db
      .select({ seconds: streaks.seconds })
      .from(streaks)
      .where(and(eq(streaks.userId, user.id), eq(streaks.day, today)))
      .limit(1),
  ])

  const targets = Object.fromEntries(rows.map((row) => [row.kind, row.target]))
  const todayRow = todayRows[0]

  const todaySeconds = todayRow?.seconds ?? 0
  const dailyTargetSeconds = workspace.dailyMinutesGoal * 60

  return (
    <PageShell>
      <PageHeader
        eyebrow="Metas"
        title="O que você está mirando"
        description="Uma meta que você consegue bater vale mais que uma ambiciosa que você abandona em silêncio."
      />

      {/* Today */}
      <Card className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="flex items-center gap-1.5 text-[0.75rem] font-medium text-muted">
              <Timer className="size-3" />
              Hoje
            </p>
            <p className="display mt-2 text-3xl text-ink">
              {formatDuration(todaySeconds)}
              <span className="ml-2 text-base text-muted">of {workspace.dailyMinutesGoal} min</span>
            </p>
          </div>

          <div className="flex items-center gap-8">
            <Stat
              label="Sequência"
              value={profile.streakCurrent}
              suffix="dias"
              icon={<Flame className="size-3 text-brand-600 dark:text-brand-400" />}
            />
            <Stat label="Melhor" value={profile.streakLongest} suffix="dias" />
          </div>
        </div>

        <Progress
          value={todaySeconds}
          total={dailyTargetSeconds}
          className="mt-5"
          label="Prática diária"
        />
      </Card>

      {/* Main goal */}
      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-[0.75rem] font-medium text-muted">
              <Target className="size-3" />
              Objetivo principal
            </p>
            <p className="mt-2 text-[1.0625rem] font-semibold text-ink">
              {workspace.mainGoal ? MAIN_GOAL_LABELS[workspace.mainGoal] : 'Ainda não definido'}
            </p>
            <p className="mt-1 text-[0.8125rem] text-muted">
              Molda quais temas a Fluentia recomenda e como o professor formula as perguntas.
            </p>
          </div>

          <Link
            href="/settings"
            className="inline-flex items-center gap-2 rounded-pill border border-line px-4 py-2 text-[0.8125rem] font-medium text-muted transition-colors hover:text-ink"
          >
            <Settings2 className="size-3.5" />
            Alterar
          </Link>
        </div>
      </Card>

      <div className="mt-6">
        <GoalsForm targets={targets} progress={progress} />
      </div>
    </PageShell>
  )
}
