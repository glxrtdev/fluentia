import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Radio } from 'lucide-react'

import { TopicPicker } from '@/components/conversation/topic-picker'
import { PageHeader, PageShell } from '@/components/shell/page-header'
import { getProfile, getSettings, requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { conversations } from '@/lib/db/schema'
import { recommendNext } from '@/lib/domain/recommendations'
import { and, desc, eq } from 'drizzle-orm'

export const metadata: Metadata = { title: 'Speaking' }

export default async function SpeakPage() {
  const user = await requireUser()
  const [profile, settings] = await Promise.all([getProfile(user.id), getSettings(user.id)])

  const recommendation = recommendNext(user.id)

  const active = db
    .select({ id: conversations.id, topicLabel: conversations.topicLabel })
    .from(conversations)
    .where(and(eq(conversations.userId, user.id), eq(conversations.status, 'active')))
    .orderBy(desc(conversations.startedAt))
    .limit(1)
    .get()

  return (
    <PageShell>
      <PageHeader
        eyebrow="Speaking"
        title="Choose a topic"
        description="Pick something you would actually talk about. The teacher opens the conversation, listens to your answer and keeps it going."
      />

      {active && (
        <Link
          href={`/speak/${active.id}`}
          className="mt-6 flex items-center justify-between gap-4 rounded-card border border-brand-500/30 bg-brand-500/6 p-4 transition-colors hover:bg-brand-500/10"
        >
          <span className="flex items-center gap-3">
            <span className="relative flex size-8 items-center justify-center rounded-full bg-brand-500/15">
              <span className="absolute inset-0 rounded-full bg-brand-500/20 animate-halo" />
              <Radio className="size-4 text-brand-600 dark:text-brand-400" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink">Session in progress</span>
              <span className="block text-[0.8125rem] text-muted">{active.topicLabel}</span>
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-brand-600 dark:text-brand-400" />
        </Link>
      )}

      <div className="mt-8">
        <TopicPicker
          defaultLevel={profile.level}
          hasApiKey={Boolean(settings.openaiKeyHint)}
          suggestion={
            recommendation
              ? { topicId: recommendation.topicId, reason: recommendation.reason }
              : null
          }
        />
      </div>
    </PageShell>
  )
}
