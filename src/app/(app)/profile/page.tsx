import type { Metadata } from 'next'
import Link from 'next/link'
import { and, desc, eq, sql } from 'drizzle-orm'
import { ArrowRight, Minus, TrendingUp } from 'lucide-react'

import { PageHeader, PageShell } from '@/components/shell/page-header'
import { Card, SectionTitle } from '@/components/ui/card'
import { Badge, Progress, Stat } from '@/components/ui/misc'
import { getProfile, requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { conversations, mistakes, sessionReports } from '@/lib/db/schema'
import { CORRECTION_CATEGORIES } from '@/lib/db/schema'
import { learningSnapshot } from '@/lib/domain/recommendations'
import { CATEGORY_LABELS, cn, formatDuration, LEVEL_LABELS } from '@/lib/utils'

export const metadata: Metadata = { title: 'English profile' }

const CEFR_SCALE = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export default async function ProfilePage() {
  const user = await requireUser()
  const profile = await getProfile(user.id)
  const snapshot = learningSnapshot(user.id)

  const trend = db
    .select({
      speaking: sessionReports.speaking,
      createdAt: sessionReports.createdAt,
      topicLabel: conversations.topicLabel,
      conversationId: sessionReports.conversationId,
    })
    .from(sessionReports)
    .innerJoin(conversations, eq(conversations.id, sessionReports.conversationId))
    .where(eq(sessionReports.userId, user.id))
    .orderBy(desc(sessionReports.createdAt))
    .limit(8)
    .all()
    .reverse()

  const mistakeMix = db
    .select({
      category: mistakes.category,
      total: sql<number>`sum(${mistakes.occurrences})`,
    })
    .from(mistakes)
    .where(and(eq(mistakes.userId, user.id), eq(mistakes.status, 'open')))
    .groupBy(mistakes.category)
    .all()

  const mixTotal = mistakeMix.reduce((total, row) => total + row.total, 0)
  const cefrIndex = profile.estimatedCefr ? CEFR_SCALE.indexOf(profile.estimatedCefr) : -1

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
        eyebrow="English profile"
        title="How you speak"
        description="Built entirely from your own sessions. The teacher reads this before every conversation."
      />

      {/* Level */}
      <Card className="mt-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <SectionTitle>Level</SectionTitle>
            <p className="display mt-2 text-4xl text-ink">
              {profile.estimatedCefr ?? LEVEL_LABELS[profile.level]}
            </p>
            <p className="mt-1.5 text-[0.8125rem] text-muted">
              {profile.estimatedCefr
                ? `Estimated from your sessions · practising at ${LEVEL_LABELS[profile.level]}`
                : 'Finish a session and Fluentia estimates your CEFR level'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {profile.autoAdaptLevel && <Badge tone="brand">Auto-adapting</Badge>}
            {improvement !== null && (
              <Badge tone={improvement >= 0 ? 'brand' : 'rose'}>
                {improvement >= 0 ? <TrendingUp className="size-3" /> : <Minus className="size-3" />}
                {improvement >= 0 ? '+' : ''}
                {improvement} on speaking
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
        <Stat label="Vocabulary" value={snapshot.words.total} suffix="words" />
        <Stat label="Speaking" value={profile.sessionsCompleted} suffix="sessions" />
        <Stat label="Mistakes" value={snapshot.mistakes.tracked} suffix="tracked" />
        <Stat label="Time" value={formatDuration(profile.totalPracticeSeconds)} />
      </div>

      {/* Strengths and weaknesses */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <Card>
          <SectionTitle>Strengths</SectionTitle>
          {profile.strengths.length === 0 ? (
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted">
              Your first session report fills this in.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {profile.strengths.map((item) => (
                <li key={item} className="flex items-center gap-2 text-[0.875rem] text-ink">
                  <span className="size-1.5 rounded-full bg-brand-500" />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle>Needs improvement</SectionTitle>
          {profile.weaknesses.length === 0 ? (
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted">
              Nothing flagged yet — have a conversation and this becomes specific.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {profile.weaknesses.map((item) => (
                <li key={item} className="flex items-center gap-2 text-[0.875rem] text-ink">
                  <span className="size-1.5 rounded-full bg-amber" />
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
          <SectionTitle>Averages across {snapshot.scores.sessions} scored sessions</SectionTitle>
          <ul className="mt-4 space-y-4">
            {(
              [
                ['Speaking', snapshot.scores.speaking],
                ['Grammar', snapshot.scores.grammar],
                ['Vocabulary', snapshot.scores.vocabulary],
                ['Fluency', snapshot.scores.fluency],
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
            <SectionTitle>Where your mistakes come from</SectionTitle>
            <Link
              href="/mistakes"
              className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted transition-colors hover:text-ink"
            >
              Details
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="mt-4 flex h-2 overflow-hidden rounded-pill bg-surface-2">
            {CORRECTION_CATEGORIES.map((category, index) => {
              const row = mistakeMix.find((entry) => entry.category === category)
              if (!row) return null
              const colors = [
                'bg-rose',
                'bg-iris',
                'bg-amber',
                'bg-brand-500',
                'bg-brand-700',
                'bg-line-strong',
              ]
              return (
                <span
                  key={category}
                  className={colors[index % colors.length]}
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
              const colors = [
                'bg-rose',
                'bg-iris',
                'bg-amber',
                'bg-brand-500',
                'bg-brand-700',
                'bg-line-strong',
              ]
              return (
                <li key={category} className="flex items-center gap-1.5 text-[0.75rem] text-muted">
                  <span className={cn('size-2 rounded-full', colors[index % colors.length])} />
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
          <SectionTitle>Speaking score over time</SectionTitle>
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
