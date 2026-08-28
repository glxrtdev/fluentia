import 'server-only'


import { narrowCorrection } from '@/lib/corrections/diff'
import type { CorrectionCategory } from '@/lib/db/schema'

import { AiError, type AiClient } from '@/lib/ai'
import { TURN_SCHEMA } from './prompts'

export type TurnCorrection = {
  category: CorrectionCategory
  original: string
  corrected: string
  explanation: string
  betterSentence: string | null
  severity: number
}

export type TurnResult = {
  reply: string
  corrections: TurnCorrection[]
  levelSignal: 'too_easy' | 'right' | 'too_hard'
}

/** Speech to text using the user's own key. Returns the raw transcript. */
export async function transcribe(ai: AiClient, audio: File, language = 'en'): Promise<string> {
  return ai.transcribe(audio, language)
}

type RawTurn = {
  reply?: unknown
  corrections?: unknown
  level_signal?: unknown
}

const CATEGORIES: CorrectionCategory[] = [
  'grammar',
  'vocabulary',
  'prepositions',
  'pronunciation',
  'sentence-structure',
  'naturalness',
]

function normalise(raw: RawTurn): TurnResult {
  const reply = typeof raw.reply === 'string' ? raw.reply.trim() : ''
  if (!reply) throw new AiError('O professor não gerou uma resposta. Tente de novo.')

  const corrections: TurnCorrection[] = Array.isArray(raw.corrections)
    ? raw.corrections
        .slice(0, 3)
        .map((entry) => entry as Record<string, unknown>)
        .filter(
          (entry) =>
            typeof entry?.original === 'string' &&
            typeof entry?.corrected === 'string' &&
            String(entry.original).trim().length > 0 &&
            String(entry.corrected).trim().length > 0 &&
            String(entry.original).trim().toLowerCase() !==
              String(entry.corrected).trim().toLowerCase(),
        )
        .map((entry) => {
          /*
           * Asking for the shortest quote is not enough on its own — a clause
           * rewritten for naturalness comes back as the whole sentence twice
           * over. Trimming the words both sides share leaves the part that is
           * genuinely wrong, which is what gets underlined in the transcript
           * and counted in the mistakes ledger.
           */
          const quote = narrowCorrection(
            String(entry.original).trim().slice(0, 240),
            String(entry.corrected).trim().slice(0, 240),
          )

          return {
            category: CATEGORIES.includes(entry.category as CorrectionCategory)
              ? (entry.category as CorrectionCategory)
              : 'grammar',
            original: quote.original,
            corrected: quote.corrected,
            explanation: String(entry.explanation ?? '').trim().slice(0, 400),
            betterSentence: String(entry.better_sentence ?? '').trim().slice(0, 400) || null,
            severity: Math.min(3, Math.max(1, Number(entry.severity) || 2)),
          }
        })
    : []

  const signal = raw.level_signal
  return {
    reply,
    corrections,
    levelSignal:
      signal === 'too_easy' || signal === 'too_hard' ? signal : 'right',
  }
}

/**
 * One conversation turn: the teacher's spoken reply plus the corrections that
 * belong on screen. A single call keeps latency low and keeps the reply and its
 * corrections consistent with each other.
 */
export async function generateTurn(
  ai: AiClient,
  args: {
    systemPrompt: string
    history: { role: 'user' | 'assistant'; content: string }[]
    userText: string | null
  },
): Promise<TurnResult> {
  const messages = [
    ...args.history.map((m) => ({ role: m.role, content: m.content })),
    {
      role: 'user' as const,
      content:
        args.userText ||
        '[The learner just joined the call and has not spoken yet. Greet them briefly by name and open the topic with one clear, concrete question. Return an empty corrections array.]',
    },
  ]

  const parsed = (await ai.chatJson({
    system: args.systemPrompt,
    messages,
    schema: TURN_SCHEMA as unknown as Record<string, unknown>,
    schemaName: 'conversation_turn',
    temperature: 0.8,
    maxTokens: 700,
  })) as RawTurn

  return normalise(parsed)
}
