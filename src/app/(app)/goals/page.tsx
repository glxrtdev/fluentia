import type { Metadata } from 'next'
import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { Flame, Settings2, Target, Timer } from 'lucide-react'

import { GoalsForm } from '@/components/goals/goals-form'
import { PageHeader, PageShell } from '@/components/shell/page-header'
import { Card } from '@/components/ui/card'
import { Progress, Stat } from '@/components/ui/misc'
import { getProfile, requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { goals, streaks } from '@/lib/db/schema'
import { weeklyProgress } from '@/lib/domain/recommendations'
import { and } from 'drizzle-orm'
import { formatDuration, localDay, startOfWeek } from '@/lib/utils'

export const metadata: Metadata = { title: 'Goals' }

const MAIN_GOAL_LABELS: Record<string, string> = {
  travel: 'Travel',
  career: 'Career',
  studies: 'Studies',
  interviews: 'Interviews',
  'daily-conversation': 'Daily conversation',
  fluency: 'Fluency',
}

export default async function GoalsPage() {
  const user = await requireUser()
  const profile = await getProfile(user.id)

  const today = localDay()
  const progress = weeklyProgress(user.id, startOfWeek(today))

  const rows = db.select().from(goals).where(eq(goals.userId, user.id)).all()
  const targets = Object.fromEntries(rows.map((row) => [row.kind, row.target]))

  const todayRow = db
    .select({ seconds: streaks.seconds })
    .from(streaks)
    .where(and(eq(streaks.userId, user.id), eq(streaks.day, today)))
    .get()

  const todaySeconds = todayRow?.seconds ?? 0
  const dailyTargetSeconds = profile.dailyMinutesGoal * 60

  return (
    <PageShell>
      <PageHeader
        eyebrow="Goals"
        title="What you are aiming at"
        description="A goal you can actually hit beats an ambitious one you quietly abandon."
      />

      {/* Today */}
      <Card className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-faint">
              <Timer className="size-3" />
              Today
            </p>
            <p className="display mt-2 text-3xl text-ink">
              {formatDuration(todaySeconds)}
              <span className="ml-2 text-base text-muted">of {profile.dailyMinutesGoal} min</span>
            </p>
          </div>

          <div className="flex items-center gap-8">
            <Stat
              label="Streak"
              value={profile.streakCurrent}
              suffix="days"
              icon={<Flame className="size-3 text-amber" />}
            />
            <Stat label="Best" value={profile.streakLongest} suffix="days" />
          </div>
        </div>

        <Progress
          value={todaySeconds}
          total={dailyTargetSeconds}
          className="mt-5"
          label="Daily practice"
        />
      </Card>

      {/* Main goal */}
      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-faint">
              <Target className="size-3" />
              Main goal
            </p>
            <p className="mt-2 text-[1.0625rem] font-semibold text-ink">
              {profile.mainGoal ? MAIN_GOAL_LABELS[profile.mainGoal] : 'Not set yet'}
            </p>
            <p className="mt-1 text-[0.8125rem] text-muted">
              Shapes which topics Fluentia recommends and how the teacher frames questions.
            </p>
          </div>

          <Link
            href="/settings"
            className="inline-flex items-center gap-2 rounded-pill border border-line px-4 py-2 text-[0.8125rem] font-medium text-muted transition-colors hover:text-ink"
          >
            <Settings2 className="size-3.5" />
            Change
          </Link>
        </div>
      </Card>

      <div className="mt-6">
        <GoalsForm targets={targets} progress={progress} />
      </div>
    </PageShell>
  )
}
