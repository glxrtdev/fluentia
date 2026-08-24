import type { Metadata } from 'next'
import Link from 'next/link'
import { and, desc, eq } from 'drizzle-orm'
import { ChevronDown, SpellCheck, X } from 'lucide-react'

import { PageHeader, PageShell } from '@/components/shell/page-header'
import { MistakeActions } from '@/components/mistakes/mistake-actions'
import { Card } from '@/components/ui/card'
import { Badge, EmptyState } from '@/components/ui/misc'
import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { conversations, mistakeOccurrences, mistakes } from '@/lib/db/schema'
import { CORRECTION_CATEGORIES } from '@/lib/db/schema'
import { CATEGORY_LABELS, cn, formatRelative } from '@/lib/utils'

export const metadata: Metadata = { title: 'My mistakes' }

const STATUS_TONE = { open: 'danger', improving: 'neutral', resolved: 'accent' } as const

export default async function MistakesPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string; category?: string }>
}) {
  const user = await requireUser()
  const { open, category } = await searchParams

  const rows = await db
    .select()
    .from(mistakes)
    .where(eq(mistakes.userId, user.id))
    .orderBy(desc(mistakes.occurrences), desc(mistakes.lastSeenAt))

  const filtered = category ? rows.filter((row) => row.category === category) : rows
  const opened = open ? rows.find((row) => row.id === open) : undefined

  const occurrences = opened
    ? await db
        .select({
          id: mistakeOccurrences.id,
          sentence: mistakeOccurrences.sentence,
          createdAt: mistakeOccurrences.createdAt,
          topicLabel: conversations.topicLabel,
          conversationId: mistakeOccurrences.conversationId,
        })
        .from(mistakeOccurrences)
        .leftJoin(conversations, eq(conversations.id, mistakeOccurrences.conversationId))
        .where(
          and(
            eq(mistakeOccurrences.mistakeId, opened.id),
            eq(mistakeOccurrences.userId, user.id),
          ),
        )
        .orderBy(desc(mistakeOccurrences.createdAt))
        .limit(5)
    : []

  const byCategory = CORRECTION_CATEGORIES.map((value) => ({
    value,
    label: CATEGORY_LABELS[value],
    count: rows.filter((row) => row.category === value).length,
  })).filter((group) => group.count > 0)

  const totalOccurrences = rows.reduce((total, row) => total + row.occurrences, 0)

  return (
    <PageShell>
      <PageHeader
        eyebrow="My mistakes"
        title="Your common mistakes"
        description="Every correction raised during a conversation lands here and is counted. The teacher reads this list before your next session and steers towards what you keep getting wrong."
      />

      {rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<SpellCheck className="size-4" />}
            title="No mistakes tracked yet"
            description="Have a conversation and the patterns worth fixing will collect here — with counts, examples and the correct form."
            action={
              <Link
                href="/speak"
                className="inline-flex items-center gap-2 rounded-pill bg-brand-500 px-4 py-2 text-[0.875rem] font-medium text-white transition-colors hover:bg-brand-600"
              >
                Start a conversation
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link
              href="/mistakes"
              className={cn(
                'rounded-pill border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors',
                !category
                  ? 'border-brand-500 bg-brand-500/8 text-ink'
                  : 'border-line text-muted hover:text-ink',
              )}
            >
              All
              <span className="ml-1.5 text-[0.6875rem] text-faint">{rows.length}</span>
            </Link>
            {byCategory.map((group) => (
              <Link
                key={group.value}
                href={`/mistakes?category=${group.value}`}
                className={cn(
                  'rounded-pill border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors',
                  category === group.value
                    ? 'border-brand-500 bg-brand-500/8 text-ink'
                    : 'border-line text-muted hover:text-ink',
                )}
              >
                {group.label}
                <span className="ml-1.5 text-[0.6875rem] text-faint">{group.count}</span>
              </Link>
            ))}
          </div>

          <p className="mt-4 text-[0.8125rem] text-muted">
            {rows.length} tracked {rows.length === 1 ? 'pattern' : 'patterns'} · {totalOccurrences}{' '}
            total occurrences
          </p>

          {/* Detail of the opened mistake */}
          {opened && (
            <Card className="mt-6 animate-fade-up border-brand-500/25">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONE[opened.status]}>{opened.status}</Badge>
                    <Badge>{CATEGORY_LABELS[opened.category]}</Badge>
                    <span className="text-[0.6875rem] font-semibold text-faint">
                      {opened.occurrences}× · last {formatRelative(opened.lastSeenAt)}
                    </span>
                  </div>

                  <p className="mt-3 text-lg leading-relaxed">
                    <span className="text-muted line-through decoration-rose/50 decoration-2">
                      {opened.original}
                    </span>
                    <span className="mx-2.5 text-faint">→</span>
                    <span className="font-semibold text-brand-600 dark:text-brand-400">
                      {opened.corrected}
                    </span>
                  </p>

                  {opened.explanation && (
                    <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-soft">
                      {opened.explanation}
                    </p>
                  )}
                </div>

                <Link
                  href={category ? `/mistakes?category=${category}` : '/mistakes'}
                  aria-label="Close detail"
                  className="rounded-lg p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <X className="size-4" />
                </Link>
              </div>

              {occurrences.length > 0 && (
                <div className="mt-5 border-t border-line pt-4">
                  <p className="mb-3 text-[0.75rem] font-medium text-muted">
                    Last occurrences
                  </p>
                  <ul className="space-y-2.5">
                    {occurrences.map((occurrence) => (
                      <li key={occurrence.id} className="text-[0.8125rem] leading-relaxed">
                        {occurrence.sentence && (
                          <p className="text-ink-soft">
                            &ldquo;{occurrence.sentence.slice(0, 220)}&rdquo;
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-faint">
                          {occurrence.conversationId && occurrence.topicLabel ? (
                            <Link
                              href={`/sessions/${occurrence.conversationId}`}
                              className="transition-colors hover:text-muted"
                            >
                              {occurrence.topicLabel}
                            </Link>
                          ) : (
                            'session removed'
                          )}
                          {' · '}
                          {formatRelative(occurrence.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-5 border-t border-line pt-4">
                <MistakeActions id={opened.id} status={opened.status} />
              </div>
            </Card>
          )}

          {/* Table */}
          <div className="mt-6 overflow-x-auto rounded-card border border-line bg-surface scroll-slim">
            <table className="w-full min-w-[34rem] text-left">
              <thead>
                <tr className="border-b border-line text-[0.75rem] font-medium text-muted">
                  <th className="px-4 py-3 sm:px-5">Mistake</th>
                  <th className="px-4 py-3">Correct form</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Category</th>
                  <th className="px-4 py-3 text-right sm:px-5">Times</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((mistake) => (
                  <tr
                    key={mistake.id}
                    className={cn(
                      'group transition-colors hover:bg-surface-2',
                      mistake.status === 'resolved' && 'opacity-55',
                    )}
                  >
                    <td className="px-4 py-3.5 sm:px-5">
                      <Link
                        href={`/mistakes?${category ? `category=${category}&` : ''}open=${mistake.id}`}
                        className="flex items-center gap-2 text-[0.875rem] text-muted line-through decoration-rose/40"
                      >
                        {mistake.original}
                        <ChevronDown className="size-3 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-[0.875rem] font-semibold text-ink">
                      {mistake.corrected}
                    </td>
                    <td className="hidden px-4 py-3.5 sm:table-cell">
                      <span className="text-[0.75rem] font-medium text-faint">
                        {CATEGORY_LABELS[mistake.category]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums sm:px-5">
                      <span
                        className={cn(
                          'inline-flex min-w-8 justify-center rounded-pill px-2 py-0.5 text-[0.75rem] font-bold',
                          mistake.occurrences >= 5
                            ? 'bg-rose/10 text-rose'
                            : 'bg-surface-2 text-muted',
                        )}
                      >
                        {mistake.occurrences}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PageShell>
  )
}
