import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { ConversationRoom } from '@/components/conversation/room'
import { requireUser } from '@/lib/auth/session'
import {
  conversationCorrections,
  conversationTranscript,
  getOwnedConversation,
} from '@/lib/domain/conversation'

export const metadata: Metadata = { title: 'Speaking' }

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireUser()
  const { id } = await params

  const conversation = getOwnedConversation(user.id, id)
  if (!conversation) notFound()
  // A finished session belongs to its report, not the room.
  if (conversation.status === 'completed') redirect(`/sessions/${conversation.id}`)

  const messages = conversationTranscript(conversation.id)
  const corrections = conversationCorrections(conversation.id)

  const elapsed = Math.min(
    4 * 3600,
    Math.max(0, Math.round((Date.now() - conversation.startedAt.getTime()) / 1000)),
  )

  return (
    <ConversationRoom
      conversationId={conversation.id}
      topicLabel={conversation.topicLabel}
      level={conversation.level}
      initialMessages={messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
      }))}
      initialCorrections={corrections.map((correction) => ({
        id: correction.id,
        category: correction.category,
        original: correction.original,
        corrected: correction.corrected,
        explanation: correction.explanation,
        betterSentence: correction.betterSentence,
        severity: correction.severity,
      }))}
      elapsedSeconds={conversation.userTurns > 0 ? elapsed : 0}
      hasUserTurns={conversation.userTurns > 0}
    />
  )
}
