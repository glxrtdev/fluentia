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
import { getProfile, getSettings, requireUser } from '@/lib/auth/session'
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

export const metadata: Metadata = { title: 'Dashboard' }

const GOAL_LABELS: Record<string, { label: string; unit: string }> = {
  weekly_sessions: { label: 'Speaking sessions', unit: 'sessions' },
  weekly_minutes: { label: 'Minutes speaking', unit: 'min' },
  weekly_words: { label: 'New words', unit: 'words' },
  weekly_mistakes: { label: 'Mistakes reviewed', unit: 'mistakes' },
}

export default async function DashboardPage() {
  const user = await requireUser()
  const [profile, settings] = await Promise.all([getProfile(user.id), getSettings(user.id)])

  const today = localDay()
  const [snapshot, recommendation, progress, calendar, activeGoals, topMistakes, recentSessions] =
    await Promise.all([
      learningSnapshot(user.id),
      recommendNext(user.id),
      weeklyProgress(user.id, startOfWeek(today)),
      activityCalendar(user.id, 21, today),
      db
        .select()
        .from(goals)
        .where(and(eq(goals.userId, user.id), eq(goals.active, true))),
      db
    .select()
    .from(mistakes)
    .where(and(eq(mistakes.userId, user.id), eq(mistakes.status, 'open')))
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
    .where(and(eq(conversations.userId, user.id), eq(conversations.status, 'completed')))
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
            Your English journey
          </p>
          <h1 className="display mt-2 text-[2rem] leading-tight text-ink sm:text-[2.5rem]">
            {profile.sessionsCompleted === 0
              ? `Let's hear your voice, ${firstName}`
              : `Good to see you, ${firstName}`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="accent">{LEVEL_LABELS[profile.level]}</Badge>
          {profile.estimatedCefr && <Badge>CEFR {profile.estimatedCefr}</Badge>}
        </div>
      </header>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-6 rounded-card border border-line bg-surface p-6 sm:grid-cols-4">
        <Stat
          label="Streak"
          value={profile.streakCurrent}
          suffix={profile.streakCurrent === 1 ? 'day' : 'days'}
          icon={<Flame className="size-3 text-brand-600 dark:text-brand-400" />}
        />
        <Stat
          label="Practised"
          value={formatDuration(profile.totalPracticeSeconds)}
          icon={<Clock className="size-3" />}
        />
        <Stat
          label="Sessions"
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
            <p className="shrink-0 text-[0.6875rem] text-faint">last 21 days</p>
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
                  One step left: your OpenAI key
                </h2>
                <p className="mt-1.5 max-w-xl text-[0.8125rem] leading-relaxed text-ink-soft">
                  Fluentia speaks through your own OpenAI account. Add the key once and the
                  conversation is ready.
                </p>
              </div>
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 rounded-pill bg-ink px-5 py-2.5 text-sm font-semibold text-canvas transition-opacity hover:opacity-90"
              >
                Add my key
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
                  {recommendation ? 'Recommended for you' : 'Continue learning'}
                </p>
                <h2 className="display mt-3 text-2xl leading-tight text-on-pitch sm:text-[1.875rem]">
                  {recommendation?.topicLabel ?? 'Start a conversation'}
                </h2>
                <p className="mt-2.5 max-w-xl text-[0.875rem] leading-relaxed text-white/60">
                  {recommendation?.reason ??
                    'Pick any topic and start talking. The teacher adapts to how you speak.'}
                </p>
              </div>

              <Link
                href="/speak"
                className="inline-flex items-center gap-2 rounded-control bg-brand-500 px-5 py-2.5 text-[0.875rem] font-medium text-white transition-colors hover:bg-brand-600"
              >
                <Mic className="size-4" />
                Start speaking
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Weekly goals */}
      {activeGoals.length > 0 && (
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <SectionTitle>This week</SectionTitle>
            <Link
              href="/goals"
              className="text-[0.8125rem] font-medium text-muted transition-colors hover:text-ink"
            >
              Adjust goals
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
            <SectionTitle>Where you slip</SectionTitle>
            <Link
              href="/mistakes"
              className="text-[0.8125rem] font-medium text-muted transition-colors hover:text-ink"
            >
              All mistakes
            </Link>
          </div>

          {topMistakes.length === 0 ? (
            <EmptyState
              icon={<SpellCheck className="size-4" />}
              title="No mistakes tracked yet"
              description="After your first conversation, the patterns worth fixing collect here with real counts."
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
            <SectionTitle>Recent sessions</SectionTitle>
            <Link
              href="/sessions"
              className="text-[0.8125rem] font-medium text-muted transition-colors hover:text-ink"
            >
              All sessions
            </Link>
          </div>

          {recentSessions.length === 0 ? (
            <EmptyState
              icon={<Mic className="size-4" />}
              title="Nothing here yet"
              description="Your first conversation will appear here with its score and the mistakes it surfaced."
              action={
                <Link
                  href="/speak"
                  className="inline-flex items-center gap-2 rounded-pill bg-brand-500 px-4 py-2 text-[0.875rem] font-medium text-white transition-colors hover:bg-brand-600"
                >
                  Start one now
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
              Vocabulary
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
              Speaking average
            </p>
            <p className="display mt-1.5 text-2xl text-ink">
              {snapshot.scores.speaking ?? '—'}
            </p>
            <p className="text-xs text-faint">
              {snapshot.scores.sessions} scored {snapshot.scores.sessions === 1 ? 'session' : 'sessions'}
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
              Longest streak
            </p>
            <p className="display mt-1.5 text-2xl text-ink">{profile.streakLongest}</p>
            <p className="text-xs text-faint">
              {pct(profile.streakCurrent, Math.max(1, profile.streakLongest))}% of your best
            </p>
          </div>
          <ArrowRight className="size-4 text-faint transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </PageShell>
  )
}
