import type { Metadata } from 'next'
import Link from 'next/link'
import { and, desc, eq, sql } from 'drizzle-orm'
import { ArrowRight, Minus, TrendingUp } from 'lucide-react'

import { PageHeader, PageShell } from '@/components/shell/page-header'
import { Card, SectionTitle } from '@/components/ui/card'
import { Badge, Progress, Stat } from '@/components/ui/misc'
import { getProfile, requireUser, requireWorkspace } from '@/lib/auth/session'
import { LevelProgress } from '@/components/progress/level-progress'
import { getLanguage } from '@/lib/languages'
import { db } from '@/lib/db'
import { conversations, mistakes, sessionReports } from '@/lib/db/schema'
import { CORRECTION_CATEGORIES } from '@/lib/db/schema'
import { learningSnapshot } from '@/lib/domain/recommendations'
import { CATEGORY_LABELS, cn, formatDuration, LEVEL_LABELS } from '@/lib/utils'

export const metadata: Metadata = { title: 'Perfil de idioma' }

const MIX_SHADES = [
  'bg-brand-500',
  'bg-brand-500/80',
  'bg-brand-500/60',
  'bg-brand-500/45',
  'bg-brand-500/30',
  'bg-brand-500/20',
]

const CEFR_SCALE = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export default async function ProfilePage() {
  const user = await requireUser()
  const [profile, workspace] = await Promise.all([getProfile(user.id), requireWorkspace(user.id)])
  const [snapshot, trendRows, mistakeMix] = await Promise.all([
    learningSnapshot(workspace.id),
    db
    .select({
      speaking: sessionReports.speaking,
      createdAt: sessionReports.createdAt,
      topicLabel: conversations.topicLabel,
      conversationId: sessionReports.conversationId,
    })
    .from(sessionReports)
    .innerJoin(conversations, eq(conversations.id, sessionReports.conversationId))
    .where(eq(sessionReports.workspaceId, workspace.id))
      .orderBy(desc(sessionReports.createdAt))
      .limit(8),
    db
    .select({
      category: mistakes.category,
      total: sql<number>`coalesce(sum(${mistakes.occurrences}), 0)::int`,
    })
    .from(mistakes)
    .where(and(eq(mistakes.workspaceId, workspace.id), eq(mistakes.status, 'open')))
      .groupBy(mistakes.category),
  ])

  const trend = [...trendRows].reverse()

  const mixTotal = mistakeMix.reduce((total, row) => total + row.total, 0)
  const cefrIndex = CEFR_SCALE.indexOf(workspace.officialCefr)

  const improvement =
    trend.length >= 4
      ? Math.round(
          trend.slice(-3).reduce((t, r) => t + r.speaking, 0) / 3 -
            trend.slice(0, 3).reduce((t, r) => t + r.speaking, 0) / 3,
        )
      : null

  return (
    <PageShell>
      <PageHeader
        eyebrow={`Perfil de ${getLanguage(workspace.language).name.pt}`}
        title="Como você fala"
        description="Montado inteiramente a partir das suas sessões. O professor lê isto antes de cada conversa."
      />

      <LevelProgress
        cefr={workspace.officialCefr}
        progress={workspace.levelProgress}
        streak={workspace.consistencyStreak}
        className="mt-8"
      />

      {/* Nível */}
      <Card className="mt-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <SectionTitle>Nível</SectionTitle>
            <p className="display mt-2 text-4xl text-ink">{workspace.officialCefr}</p>
            <p className="mt-1.5 text-[0.8125rem] text-muted">
              Conquistado pelas suas sessões · praticando em{' '}
              {LEVEL_LABELS[workspace.level]}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {workspace.autoAdaptLevel && <Badge tone="accent">Ajuste automático</Badge>}
            {improvement !== null && (
              <Badge tone={improvement >= 0 ? 'accent' : 'danger'}>
                {improvement >= 0 ? <TrendingUp className="size-3" /> : <Minus className="size-3" />}
                {improvement >= 0 ? '+' : ''}
                {improvement} em fala
              </Badge>
            )}
          </div>
        </div>

        {cefrIndex >= 0 && (
          <div className="mt-6 flex gap-1.5">
            {CEFR_SCALE.map((level, index) => (
              <div key={level} className="flex-1">
                <div
                  className={cn(
                    'h-1.5 rounded-pill transition-colors',
                    index <= cefrIndex ? 'bg-brand-500' : 'bg-surface-2',
                  )}
                />
                <p
                  className={cn(
                    'mt-1.5 text-center text-[0.625rem] font-semibold',
                    index === cefrIndex ? 'text-ink' : 'text-faint',
                  )}
                >
                  {level}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Counters */}
      <div className="mt-6 grid grid-cols-2 gap-6 rounded-card border border-line bg-surface p-6 sm:grid-cols-4">
        <Stat label="Vocabulário" value={snapshot.words.total} suffix="palavras" />
        <Stat label="Fala" value={profile.sessionsCompleted} suffix="sessões" />
        <Stat label="Erros" value={snapshot.mistakes.tracked} suffix="registrados" />
        <Stat label="Tempo" value={formatDuration(profile.totalPracticeSeconds)} />
      </div>

      {/* Pontos fortes and weaknesses */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <Card>
          <SectionTitle>Pontos fortes</SectionTitle>
          {workspace.strengths.length === 0 ? (
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted">
              O relatório da sua primeira sessão preenche isto.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {workspace.strengths.map((item) => (
                <li key={item} className="flex items-center gap-2 text-[0.875rem] text-ink">
                  <span className="size-1.5 rounded-full bg-brand-500" />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle>A melhorar</SectionTitle>
          {workspace.weaknesses.length === 0 ? (
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted">
              Nada apontado ainda — converse um pouco e isto fica específico.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {workspace.weaknesses.map((item) => (
                <li key={item} className="flex items-center gap-2 text-[0.875rem] text-ink">
                  <span className="size-1.5 rounded-full bg-brand-500" />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Score averages */}
      {snapshot.scores.sessions > 0 && (
        <Card className="mt-6">
          <SectionTitle>
            Médias de {snapshot.scores.sessions}{' '}
            {snapshot.scores.sessions === 1 ? 'sessão avaliada' : 'sessões avaliadas'}
          </SectionTitle>
          <ul className="mt-4 space-y-4">
            {(
              [
                ['Fala', snapshot.scores.speaking],
                ['Gramática', snapshot.scores.grammar],
                ['Vocabulário', snapshot.scores.vocabulary],
                ['Fluência', snapshot.scores.fluency],
              ] as const
            ).map(([label, value]) => (
              <li key={label}>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="text-[0.8125rem] font-medium text-ink">{label}</span>
                  <span className="text-[0.8125rem] font-semibold tabular-nums text-muted">
                    {value ?? '—'}
                  </span>
                </div>
                <Progress value={value ?? 0} total={100} label={label} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Mistake mix */}
      {mixTotal > 0 && (
        <Card className="mt-6">
          <div className="flex items-center justify-between">
            <SectionTitle>De onde vêm seus erros</SectionTitle>
            <Link
              href="/mistakes"
              className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted transition-colors hover:text-ink"
            >
              Detalhes
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="mt-4 flex h-2 overflow-hidden rounded-pill bg-surface-2">
            {CORRECTION_CATEGORIES.map((category, index) => {
              const row = mistakeMix.find((entry) => entry.category === category)
              if (!row) return null
              return (
                <span
                  key={category}
                  className={MIX_SHADES[index % MIX_SHADES.length]}
                  style={{ width: `${(row.total / mixTotal) * 100}%` }}
                  title={`${CATEGORY_LABELS[category]}: ${row.total}`}
                />
              )
            })}
          </div>

          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {CORRECTION_CATEGORIES.map((category, index) => {
              const row = mistakeMix.find((entry) => entry.category === category)
              if (!row) return null
              return (
                <li key={category} className="flex items-center gap-1.5 text-[0.75rem] text-muted">
                  <span className={cn('size-2 rounded-full', MIX_SHADES[index % MIX_SHADES.length])} />
                  {CATEGORY_LABELS[category]}
                  <span className="font-semibold text-ink">{row.total}</span>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {/* Trend */}
      {trend.length >= 2 && (
        <Card className="mt-6">
          <SectionTitle>Nota de fala ao longo do tempo</SectionTitle>
          <div className="mt-6 flex h-32 items-end gap-2">
            {trend.map((point) => (
              <Link
                key={point.conversationId}
                href={`/sessions/${point.conversationId}`}
                title={`${point.topicLabel}: ${point.speaking}`}
                className="group flex flex-1 flex-col items-center justify-end gap-2"
              >
                <span className="text-[0.6875rem] font-semibold tabular-nums text-muted opacity-0 transition-opacity group-hover:opacity-100">
                  {point.speaking}
                </span>
                <span
                  className="w-full rounded-t-md bg-brand-500/70 transition-colors group-hover:bg-brand-500"
                  style={{ height: `${Math.max(4, point.speaking)}%` }}
                />
              </Link>
            ))}
          </div>
          <p className="mt-3 text-[0.6875rem] text-faint">
            oldest → newest, {trend.length} most recent scored sessions
          </p>
        </Card>
      )}
    </PageShell>
  )
}
