import type { Metadata } from 'next'
import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { ArrowRight, Mic } from 'lucide-react'

import { PageHeader, PageShell } from '@/components/shell/page-header'
import { Badge, EmptyState } from '@/components/ui/misc'
import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { conversations, sessionReports } from '@/lib/db/schema'
import { CATEGORY_BY_ID } from '@/lib/domain/topics'
import { cn, formatDate, formatDuration, LEVEL_LABELS } from '@/lib/utils'

export const metadata: Metadata = { title: 'My sessions' }

export default async function SessionsPage() {
  const user = await requireUser()

  const rows = db
    .select({
      id: conversations.id,
      topicLabel: conversations.topicLabel,
      category: conversations.category,
      level: conversations.level,
      status: conversations.status,
      startedAt: conversations.startedAt,
      durationSeconds: conversations.durationSeconds,
      userTurns: conversations.userTurns,
      speaking: sessionReports.speaking,
      grammar: sessionReports.grammar,
      vocabulary: sessionReports.vocabulary,
      fluency: sessionReports.fluency,
      estimatedLevel: sessionReports.estimatedLevel,
      mainMistakes: sessionReports.mainMistakes,
    })
    .from(conversations)
    .leftJoin(sessionReports, eq(sessionReports.conversationId, conversations.id))
    .where(eq(conversations.userId, user.id))
    .orderBy(desc(conversations.startedAt))
    .limit(60)
    .all()

  return (
    <PageShell>
      <PageHeader
        eyebrow="History"
        title="My sessions"
        description="Every conversation you have had, with its score, its length and the mistakes it surfaced."
      />

      {rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<Mic className="size-4" />}
            title="No sessions yet"
            description="Your conversations, reports and transcripts will live here."
            action={
              <Link
                href="/speak"
                className="inline-flex items-center gap-2 rounded-pill bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white dark:bg-brand-500 dark:text-[#04201d]"
              >
                Start your first conversation
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {rows.map((session) => {
            const live = session.status === 'active'
            const mistakes = Array.isArray(session.mainMistakes) ? session.mainMistakes : []

            return (
              <li key={session.id}>
                <Link
                  href={live ? `/speak/${session.id}` : `/sessions/${session.id}`}
                  className={cn(
                    'group flex flex-wrap items-center gap-4 rounded-card border bg-surface p-4 transition-colors sm:px-5',
                    live
                      ? 'border-brand-500/30 hover:bg-brand-500/6'
                      : 'border-line hover:bg-surface-2',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[0.9375rem] font-semibold text-ink">
                        {session.topicLabel}
                      </span>
                      {live && <Badge tone="brand">in progress</Badge>}
                      <Badge>
                        {CATEGORY_BY_ID.get(session.category as never)?.label ?? 'Custom'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {formatDate(session.startedAt)} · {LEVEL_LABELS[session.level] ?? session.level}
                      {!live && ` · ${formatDuration(session.durationSeconds)}`}
                      {` · ${session.userTurns} ${session.userTurns === 1 ? 'turn' : 'turns'}`}
                    </p>

                    {mistakes.length > 0 && (
                      <p className="mt-2 flex flex-wrap gap-1.5">
                        {mistakes.slice(0, 3).map((mistake) => (
                          <span
                            key={mistake.label}
                            className="rounded-pill bg-surface-2 px-2 py-0.5 text-[0.6875rem] font-medium text-muted"
                          >
                            {mistake.label}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>

                  {session.speaking !== null ? (
                    <div className="flex items-center gap-5">
                      <div className="hidden gap-4 sm:flex">
                        {(
                          [
                            ['G', session.grammar],
                            ['V', session.vocabulary],
                            ['F', session.fluency],
                          ] as const
                        ).map(([label, value]) => (
                          <div key={label} className="text-center">
                            <p className="text-[0.6875rem] font-bold text-faint">{label}</p>
                            <p className="text-[0.8125rem] font-semibold tabular-nums text-ink-soft">
                              {value}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="text-right">
                        <p className="display text-2xl leading-none text-ink">{session.speaking}</p>
                        <p className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-faint">
                          {session.estimatedLevel}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <ArrowRight className="size-4 text-faint transition-transform group-hover:translate-x-0.5" />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </PageShell>
  )
}
