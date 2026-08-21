import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { ArrowLeft, ArrowRight, Clock, Lightbulb, MessageSquareQuote, Quote } from 'lucide-react'

import { CorrectionCard } from '@/components/conversation/feedback-panel'
import { SaveWordButton } from '@/components/sessions/save-word-button'
import { PageShell } from '@/components/shell/page-header'
import { Card, SectionTitle } from '@/components/ui/card'
import { Badge, ScoreRing } from '@/components/ui/misc'
import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { sessionReports } from '@/lib/db/schema'
import {
  conversationCorrections,
  conversationTranscript,
  getOwnedConversation,
} from '@/lib/domain/conversation'
import { formatDate, formatDuration, LEVEL_LABELS } from '@/lib/utils'

export const metadata: Metadata = { title: 'Session report' }

export default async function SessionReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireUser()
  const { id } = await params

  const conversation = getOwnedConversation(user.id, id)
  if (!conversation) notFound()
  if (conversation.status === 'active') redirect(`/speak/${conversation.id}`)

  const report = db
    .select()
    .from(sessionReports)
    .where(eq(sessionReports.conversationId, conversation.id))
    .get()

  const transcript = conversationTranscript(conversation.id)
  const corrections = conversationCorrections(conversation.id)

  return (
    <PageShell>
      <Link
        href="/sessions"
        className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        All sessions
      </Link>

      <header className="mt-5 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-faint">
            Session report
          </p>
          <h1 className="display mt-2 text-[2rem] leading-tight text-ink">
            {conversation.topicLabel}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[0.8125rem] text-muted">
            <span>{formatDate(conversation.startedAt)}</span>
            <span className="text-faint">·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              {formatDuration(conversation.durationSeconds)}
            </span>
            <span className="text-faint">·</span>
            <span>{LEVEL_LABELS[conversation.level] ?? conversation.level}</span>
          </p>
        </div>

        {report && (
          <div className="flex items-center gap-2">
            <Badge tone="brand">Estimated {report.estimatedLevel}</Badge>
            <Badge>{report.wordsSpoken} words spoken</Badge>
          </div>
        )}
      </header>

      {!report ? (
        <Card className="mt-8">
          <p className="text-[0.9375rem] font-semibold text-ink">No report for this session</p>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
            The conversation was closed before it could be scored. The transcript below is still
            yours, and any corrections it produced are already counted in your mistakes.
          </p>
        </Card>
      ) : (
        <>
          {/* Scores */}
          <section className="mt-8">
            <Card>
              <div className="flex flex-wrap items-center justify-around gap-6">
                <ScoreRing score={report.speaking} label="Speaking" size={104} />
                <ScoreRing score={report.grammar} label="Grammar" />
                <ScoreRing score={report.vocabulary} label="Vocabulary" />
                <ScoreRing score={report.fluency} label="Fluency" />
                {report.pronunciation !== null ? (
                  <ScoreRing score={report.pronunciation} label="Pronunciation" />
                ) : (
                  <div className="flex max-w-40 flex-col items-center gap-2 text-center">
                    <div className="flex size-[88px] items-center justify-center rounded-full border border-dashed border-line">
                      <span className="text-lg text-faint">—</span>
                    </div>
                    <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-faint">
                      Pronunciation
                    </span>
                    <span className="text-[0.6875rem] leading-relaxed text-faint">
                      not enough evidence in this session
                    </span>
                  </div>
                )}
              </div>

              <p className="mt-7 border-t border-line pt-5 text-[0.9375rem] leading-relaxed text-ink-soft">
                {report.summary}
              </p>
            </Card>
          </section>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {/* Main mistakes */}
            {report.mainMistakes.length > 0 && (
              <section>
                <SectionTitle className="mb-4">Your main mistakes</SectionTitle>
                <Card className="p-0">
                  <ol className="divide-y divide-line">
                    {report.mainMistakes.map((mistake, index) => (
                      <li key={mistake.label} className="flex gap-3 p-4 sm:px-5">
                        <span className="display text-lg leading-none text-line-strong">
                          {index + 1}
                        </span>
                        <div>
                          <p className="text-[0.875rem] font-semibold text-ink">{mistake.label}</p>
                          <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
                            {mistake.detail}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </Card>
              </section>
            )}

            {/* Recommendations */}
            {report.recommendations.length > 0 && (
              <section>
                <SectionTitle className="mb-4">For your next session</SectionTitle>
                <Card>
                  <ul className="space-y-3">
                    {report.recommendations.map((recommendation) => (
                      <li key={recommendation} className="flex gap-2.5">
                        <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber" />
                        <span className="text-[0.875rem] leading-relaxed text-ink-soft">
                          {recommendation}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/speak"
                    className="mt-5 inline-flex items-center gap-2 text-[0.8125rem] font-semibold text-brand-600 transition-opacity hover:opacity-80 dark:text-brand-400"
                  >
                    Start another conversation
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Card>
              </section>
            )}

            {/* New words */}
            {report.newWords.length > 0 && (
              <section>
                <SectionTitle className="mb-4">New words</SectionTitle>
                <Card className="p-0">
                  <ul className="divide-y divide-line">
                    {report.newWords.map((entry) => (
                      <li
                        key={entry.word}
                        className="flex items-start justify-between gap-3 p-4 sm:px-5"
                      >
                        <div className="min-w-0">
                          <p className="text-[0.875rem] font-semibold text-ink">{entry.word}</p>
                          <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">
                            {entry.meaning}
                          </p>
                        </div>
                        <SaveWordButton word={entry.word} definition={entry.meaning} />
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            )}

            {/* Expressions */}
            {report.expressions.length > 0 && (
              <section>
                <SectionTitle className="mb-4">Interesting expressions</SectionTitle>
                <Card className="p-0">
                  <ul className="divide-y divide-line">
                    {report.expressions.map((entry) => (
                      <li
                        key={entry.expression}
                        className="flex items-start justify-between gap-3 p-4 sm:px-5"
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-[0.875rem] font-semibold text-ink">
                            <Quote className="size-3 shrink-0 text-brand-500" />
                            {entry.expression}
                          </p>
                          <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">
                            {entry.meaning}
                          </p>
                        </div>
                        <SaveWordButton word={entry.expression} definition={entry.meaning} />
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            )}
          </div>
        </>
      )}

      {/* Corrections raised live */}
      {corrections.length > 0 && (
        <section className="mt-10">
          <SectionTitle className="mb-4">
            Corrections during the conversation ({corrections.length})
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {corrections.map((correction) => (
              <CorrectionCard
                key={correction.id}
                correction={{
                  id: correction.id,
                  category: correction.category,
                  original: correction.original,
                  corrected: correction.corrected,
                  explanation: correction.explanation,
                  betterSentence: correction.betterSentence,
                  severity: correction.severity,
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Transcript */}
      <section className="mt-10">
        <SectionTitle className="mb-4">
          <span className="inline-flex items-center gap-1.5">
            <MessageSquareQuote className="size-3" />
            Transcript
          </span>
        </SectionTitle>

        <Card className="space-y-5">
          {transcript.map((message) => (
            <div key={message.id}>
              <p className="mb-1 text-[0.625rem] font-bold uppercase tracking-[0.16em] text-faint">
                {message.role === 'assistant' ? 'Teacher' : 'You'}
              </p>
              <p
                className={
                  message.role === 'assistant'
                    ? 'text-[0.9375rem] leading-relaxed text-ink'
                    : 'text-[0.9375rem] leading-relaxed text-ink-soft'
                }
              >
                {message.content}
              </p>
            </div>
          ))}
        </Card>
      </section>
    </PageShell>
  )
}
