import type { Metadata } from 'next'
import {
  Award,
  BookOpen,
  Briefcase,
  Clock,
  Flame,
  Lock,
  MessagesSquare,
  Mountain,
  Sparkles,
  Star,
  Target,
  Trophy,
} from 'lucide-react'

import { PageHeader, PageShell } from '@/components/shell/page-header'
import { Card } from '@/components/ui/card'
import { Progress, Stat } from '@/components/ui/misc'
import { getProfile, requireUser } from '@/lib/auth/session'
import { listAchievements } from '@/lib/domain/gamification'
import { cn, formatNumber, formatRelative } from '@/lib/utils'

export const metadata: Metadata = { title: 'Conquistas' }

const ICONS: Record<string, typeof Award> = {
  sparkles: Sparkles,
  messages: MessagesSquare,
  trophy: Trophy,
  clock: Clock,
  flame: Flame,
  book: BookOpen,
  briefcase: Briefcase,
  mountain: Mountain,
  target: Target,
  star: Star,
}

export default async function AchievementsPage() {
  const user = await requireUser()
  const [profile, all] = await Promise.all([getProfile(user.id), listAchievements(user.id)])

  const unlocked = all.filter((achievement) => achievement.unlockedAt)

  return (
    <PageShell>
      <PageHeader
        eyebrow="Progresso"
        title="Conquistas"
        description="Desbloqueadas por atividade real — sessões concluídas, minutos falados, palavras aprendidas, erros vencidos."
      />

      <Card className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Stat label="Desbloqueada" value={`${unlocked.length}/${all.length}`} />
          <Stat label="XP" value={formatNumber(profile.xp)} />
          <Stat
            label="Sequência"
            value={profile.streakCurrent}
            suffix="dias"
            icon={<Flame className="size-3 text-brand-600 dark:text-brand-400" />}
          />
        </div>
        <Progress
          value={unlocked.length}
          total={all.length}
          className="mt-5"
          label="Conquistas desbloqueadas"
        />
      </Card>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {all.map((achievement) => {
          const Icon = ICONS[achievement.icon] ?? Award
          const isUnlocked = Boolean(achievement.unlockedAt)

          return (
            <li key={achievement.id}>
              <Card
                className={cn(
                  'h-full transition-colors',
                  isUnlocked ? 'border-brand-500/25 bg-brand-500/4' : 'opacity-70',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      'flex size-10 items-center justify-center rounded-xl',
                      isUnlocked
                        ? 'bg-brand-500/12 text-brand-600 dark:text-brand-400'
                        : 'bg-surface-2 text-faint',
                    )}
                  >
                    {isUnlocked ? <Icon className="size-4.5" /> : <Lock className="size-4" />}
                  </span>
                  <span
                    className={cn(
                      'rounded-pill px-2 py-0.5 text-[0.625rem] font-bold',
                      isUnlocked ? 'bg-brand-500/12 text-brand-600 dark:text-brand-400' : 'text-faint',
                    )}
                  >
                    +{achievement.xp} XP
                  </span>
                </div>

                <h3 className="mt-4 text-[0.9375rem] font-semibold text-ink">{achievement.title}</h3>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
                  {achievement.description}
                </p>
                {achievement.unlockedAt && (
                  <p className="mt-3 text-[0.6875rem] font-medium text-brand-600 dark:text-brand-400">
                    desbloqueada {formatRelative(achievement.unlockedAt)}
                  </p>
                )}
              </Card>
            </li>
          )
        })}
      </ul>
    </PageShell>
  )
}
