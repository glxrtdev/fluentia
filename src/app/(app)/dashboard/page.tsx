import type { Metadata } from 'next'
import Link from 'next/link'
import { and, desc, eq } from 'drizzle-orm'
import {
  ArrowRight,
  Award,
  BookMarked,
  Clock,
  Flame,
  Mic,
  Sparkles,
  SpellCheck,
  Target,
  Zap,
} from 'lucide-react'

import { PageShell } from '@/components/shell/page-header'
import { Card, SectionTitle } from '@/components/ui/card'
import { Badge, EmptyState, Progress, Stat } from '@/components/ui/misc'
import { getProfile, getSettings, requireUser, requireWorkspace } from '@/lib/auth/session'
import { getLanguage } from '@/lib/languages'
import { db } from '@/lib/db'
import { conversations, goals, mistakes, sessionReports } from '@/lib/db/schema'
import { activityCalendar } from '@/lib/domain/gamification'
import { learningSnapshot, recommendNext, weeklyProgress } from '@/lib/domain/recommendations'
import {
  CATEGORY_LABELS,
  cn,
  formatDuration,
  formatNumber,
  formatRelative,
  LEVEL_LABELS,
  localDay,
  pct,
  startOfWeek,
} from '@/lib/utils'

export const metadata: Metadata = { title: 'Painel' }

const GOAL_LABELS: Record<string, { label: string; unit: string }> = {
  weekly_sessions: { label: 'Conversas', unit: 'sessões' },
  weekly_minutes: { label: 'Minutos falando', unit: 'min' },
  weekly_words: { label: 'Palavras novas', unit: 'palavras' },
  weekly_mistakes: { label: 'Erros revisados', unit: 'erros' },
}

export default async function DashboardPage() {
  const user = await requireUser()
  const [profile, settings, workspace] = await Promise.all([
    getProfile(user.id),
    getSettings(user.id),
    requireWorkspace(user.id),
  ])

  const languageName = getLanguage(workspace.language).name.pt
  const today = localDay()
  const [snapshot, recommendation, progress, calendar, activeGoals, topMistakes, recentSessions] =
    await Promise.all([
      learningSnapshot(workspace.id),
      recommendNext(workspace.id),
      weeklyProgress(workspace.id, startOfWeek(today)),
      activityCalendar(user.id, 21, today),
      db
        .select()
        .from(goals)
        .where(and(eq(goals.workspaceId, workspace.id), eq(goals.active, true))),
      db
    .select()
    .from(mistakes)
    .where(and(eq(mistakes.workspaceId, workspace.id), eq(mistakes.status, 'open')))
        .orderBy(desc(mistakes.occurrences), desc(mistakes.lastSeenAt))
        .limit(3),
      db
    .select({
      id: conversations.id,
      topicLabel: conversations.topicLabel,
      startedAt: conversations.startedAt,
      durationSeconds: conversations.durationSeconds,
      speaking: sessionReports.speaking,
    })
    .from(conversations)
    .leftJoin(sessionReports, eq(sessionReports.conversationId, conversations.id))
    .where(and(eq(conversations.workspaceId, workspace.id), eq(conversations.status, 'completed')))
        .orderBy(desc(conversations.startedAt))
        .limit(3),
    ])

  const firstName = user.name.split(' ')[0]
  const needsKey = !settings.openaiKeyHint

  return (
    <PageShell width="wide">
      {/* Greeting */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.75rem] font-medium text-muted">
            Sua jornada em {languageName}
          </p>
          <h1 className="display mt-2 text-[2rem] leading-tight text-ink sm:text-[2.5rem]">
            {profile.sessionsCompleted === 0
              ? `Vamos ouvir sua voz, ${firstName}`
              : `Que bom te ver, ${firstName}`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="accent">{LEVEL_LABELS[workspace.level]}</Badge>
          {workspace.estimatedCefr && <Badge>CEFR {workspace.estimatedCefr}</Badge>}
        </div>
      </header>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-6 rounded-card border border-line bg-surface p-6 sm:grid-cols-4">
        <Stat
          label="Sequência"
          value={profile.streakCurrent}
          suffix={profile.streakCurrent === 1 ? 'dia' : 'dias'}
          icon={<Flame className="size-3 text-brand-600 dark:text-brand-400" />}
        />
        <Stat
          label="Praticado"
          value={formatDuration(profile.totalPracticeSeconds)}
          icon={<Clock className="size-3" />}
        />
        <Stat
          label="Sessões"
          value={profile.sessionsCompleted}
          icon={<Mic className="size-3" />}
        />
        <Stat label="XP" value={formatNumber(profile.xp)} icon={<Zap className="size-3" />} />

        {/*
          Three-week strip: real practice, one square per day.

          The squares share the row rather than each claiming a fixed 12px —
          twenty-one of those are wider than a small phone, and a fixed size
          pushed the whole stats card off the screen.
        */}
        <div className="col-span-2 border-t border-line pt-5 sm:col-span-4">
          <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
            <div className="flex min-w-0 flex-1 gap-[3px] sm:gap-1">
              {calendar.map((day) => {
                const intensity =
                  day.seconds === 0 ? 0 : day.seconds < 300 ? 1 : day.seconds < 900 ? 2 : 3
                return (
                  <span
                    key={day.day}
                    title={`${day.day} · ${formatDuration(day.seconds)}`}
                    className={cn(
                      'h-3 min-w-0 flex-1 rounded-[0.25rem] transition-colors sm:max-w-3',
                      intensity === 0 && 'bg-surface-2',
                      intensity === 1 && 'bg-brand-500/30',
                      intensity === 2 && 'bg-brand-500/60',
                      intensity === 3 && 'bg-brand-500',
                    )}
                  />
                )
              })}
            </div>
            <p className="shrink-0 text-[0.6875rem] text-faint">últimos 21 dias</p>
          </div>
        </div>
      </div>

      {/* Primary action */}
      <section className="mt-6">
        {needsKey ? (
          <Card className="border-line bg-surface-2">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-[0.9375rem] font-semibold text-ink">
                  Falta um passo: sua chave da OpenAI
                </h2>
                <p className="mt-1.5 max-w-xl text-[0.8125rem] leading-relaxed text-ink-soft">
                  A Fluentia fala pela sua própria conta da OpenAI. Adicione a chave uma vez e a
                  conversa está pronta.
                </p>
              </div>
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 rounded-pill bg-ink px-5 py-2.5 text-sm font-semibold text-canvas transition-opacity hover:opacity-90"
              >
                Adicionar minha chave
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </Card>
        ) : (
          <div className="edge-glow overflow-hidden rounded-card bg-pitch p-6 sm:p-8">
            <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-xl">
                <p className="flex items-center gap-1.5 text-[0.75rem] font-medium text-brand-400">
                  <Sparkles className="size-3" />
                  {recommendation ? 'Recomendado para você' : 'Continue aprendendo'}
                </p>
                <h2 className="display mt-3 text-2xl leading-tight text-on-pitch sm:text-[1.875rem]">
                  {recommendation?.topicLabel ?? 'Comece uma conversa'}
                </h2>
                <p className="mt-2.5 max-w-xl text-[0.875rem] leading-relaxed text-white/60">
                  {recommendation?.reason ??
                    'Escolha qualquer tema e comece a falar. O professor se adapta ao seu jeito.'}
                </p>
              </div>

              <Link
                href="/speak"
                className="inline-flex items-center gap-2 rounded-control bg-brand-500 px-5 py-2.5 text-[0.875rem] font-medium text-white transition-colors hover:bg-brand-600"
              >
                <Mic className="size-4" />
                Começar a falar
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Weekly goals */}
      {activeGoals.length > 0 && (
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <SectionTitle>Esta semana</SectionTitle>
            <Link
              href="/goals"
              className="text-[0.8125rem] font-medium text-muted transition-colors hover:text-ink"
            >
              Ajustar metas
            </Link>
          </div>

          <Card>
            <ul className="grid gap-5 sm:grid-cols-2">
              {activeGoals.map((goal) => {
                const current = progress[goal.kind] ?? 0
                const meta = GOAL_LABELS[goal.kind]
                const done = current >= goal.target
                return (
                  <li key={goal.id}>
                    <div className="mb-2 flex items-baseline justify-between gap-2">
                      <span className="text-[0.8125rem] font-medium text-ink">{meta.label}</span>
                      <span
                        className={cn(
                          'text-[0.8125rem] font-semibold tabular-nums',
                          done ? 'text-brand-600 dark:text-brand-400' : 'text-muted',
                        )}
                      >
                        {current}/{goal.target} {meta.unit}
                      </span>
                    </div>
                    <Progress
                      value={current}
                      total={goal.target}
                      tone={done ? 'accent' : 'neutral'}
                      label={meta.label}
                    />
                  </li>
                )
              })}
            </ul>
          </Card>
        </section>
      )}

      {/* Learning */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="min-w-0">
          <div className="mb-4 flex items-center justify-between">
            <SectionTitle>Onde você escorrega</SectionTitle>
            <Link
              href="/mistakes"
              className="text-[0.8125rem] font-medium text-muted transition-colors hover:text-ink"
            >
              Todos os erros
            </Link>
          </div>

          {topMistakes.length === 0 ? (
            <EmptyState
              icon={<SpellCheck className="size-4" />}
              title="Nenhum erro registrado ainda"
              description="Depois da sua primeira conversa, os padrões que valem corrigir se juntam aqui, com a contagem real."
            />
          ) : (
            <Card className="divide-y divide-line p-0">
              {topMistakes.map((mistake) => (
                <Link
                  key={mistake.id}
                  href={`/mistakes?open=${mistake.id}`}
                  className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-surface-2 sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.875rem]">
                      <span className="text-muted line-through decoration-rose/50">
                        {mistake.original}
                      </span>
                      <span className="mx-2 text-faint">→</span>
                      <span className="font-semibold text-ink">{mistake.corrected}</span>
                    </p>
                    <p className="mt-1 text-[0.75rem] font-medium text-muted">
                      {CATEGORY_LABELS[mistake.category]}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-pill bg-rose/10 px-2.5 py-1 text-[0.6875rem] font-bold text-rose">
                    {mistake.occurrences}×
                  </span>
                </Link>
              ))}
            </Card>
          )}
        </section>

        <section className="min-w-0">
          <div className="mb-4 flex items-center justify-between">
            <SectionTitle>Sessões recentes</SectionTitle>
            <Link
              href="/sessions"
              className="text-[0.8125rem] font-medium text-muted transition-colors hover:text-ink"
            >
              Todas as sessões
            </Link>
          </div>

          {recentSessions.length === 0 ? (
            <EmptyState
              icon={<Mic className="size-4" />}
              title="Nada por aqui ainda"
              description="Sua primeira conversa vai aparecer aqui, com a nota e os erros que ela revelou."
              action={
                <Link
                  href="/speak"
                  className="inline-flex items-center gap-2 rounded-pill bg-brand-500 px-4 py-2 text-[0.875rem] font-medium text-white transition-colors hover:bg-brand-600"
                >
                  Comece uma agora
                </Link>
              }
            />
          ) : (
            <Card className="divide-y divide-line p-0">
              {recentSessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/sessions/${session.id}`}
                  className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-surface-2 sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.875rem] font-medium text-ink">
                      {session.topicLabel}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {formatRelative(session.startedAt)} · {formatDuration(session.durationSeconds)}
                    </p>
                  </div>
                  {session.speaking !== null && (
                    <span className="display shrink-0 text-xl text-ink">{session.speaking}</span>
                  )}
                </Link>
              ))}
            </Card>
          )}
        </section>
      </div>

      {/* Quick links */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Link
          href="/vocabulary"
          className="group flex items-center justify-between rounded-card border border-line bg-surface p-5 transition-colors hover:bg-surface-2"
        >
          <div>
            <p className="flex items-center gap-2 text-[0.8125rem] font-medium text-muted">
              <BookMarked className="size-3.5" />
              Vocabulário
            </p>
            <p className="display mt-1.5 text-2xl text-ink">{snapshot.words.total}</p>
            <p className="text-xs text-faint">{snapshot.words.learned} learned</p>
          </div>
          <ArrowRight className="size-4 text-faint transition-transform group-hover:translate-x-0.5" />
        </Link>

        <Link
          href="/profile"
          className="group flex items-center justify-between rounded-card border border-line bg-surface p-5 transition-colors hover:bg-surface-2"
        >
          <div>
            <p className="flex items-center gap-2 text-[0.8125rem] font-medium text-muted">
              <Target className="size-3.5" />
              Média de fala
            </p>
            <p className="display mt-1.5 text-2xl text-ink">
              {snapshot.scores.speaking ?? '—'}
            </p>
            <p className="text-xs text-faint">
              {snapshot.scores.sessions} {snapshot.scores.sessions === 1 ? 'sessão avaliada' : 'sessões avaliadas'}
            </p>
          </div>
          <ArrowRight className="size-4 text-faint transition-transform group-hover:translate-x-0.5" />
        </Link>

        <Link
          href="/achievements"
          className="group flex items-center justify-between rounded-card border border-line bg-surface p-5 transition-colors hover:bg-surface-2"
        >
          <div>
            <p className="flex items-center gap-2 text-[0.8125rem] font-medium text-muted">
              <Award className="size-3.5" />
              Maior sequência
            </p>
            <p className="display mt-1.5 text-2xl text-ink">{profile.streakLongest}</p>
            <p className="text-xs text-faint">
              {pct(profile.streakCurrent, Math.max(1, profile.streakLongest))}% do seu recorde
            </p>
          </div>
          <ArrowRight className="size-4 text-faint transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </PageShell>
  )
}
