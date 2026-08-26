import 'server-only'

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

import { narrowCorrection } from '@/lib/corrections/diff'
import type { CorrectionCategory } from '@/lib/db/schema'

import { AiError, type UserAi } from './client'
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
export async function transcribe(ai: UserAi, audio: File): Promise<string> {
  const result = await ai.client.audio.transcriptions.create({
    file: audio,
    model: ai.models.stt,
    language: 'en',
    // Nudges the model towards conversational English rather than song lyrics.
    prompt: 'A student practising spoken English in a conversation with their teacher.',
    response_format: 'json',
  })

  return (result.text ?? '').trim()
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
  if (!reply) throw new AiError('The teacher did not produce a reply. Try again.')

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
  ai: UserAi,
  args: {
    systemPrompt: string
    history: { role: 'user' | 'assistant'; content: string }[]
    userText: string | null
  },
): Promise<TurnResult> {
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: args.systemPrompt },
    ...args.history.map((m) => ({ role: m.role, content: m.content }) as ChatCompletionMessageParam),
  ]

  messages.push(
    args.userText
      ? { role: 'user', content: args.userText }
      : {
          role: 'user',
          content:
            '[The learner just joined the call and has not spoken yet. Greet them briefly by name and open the topic with one clear, concrete question. Return an empty corrections array.]',
        },
  )

  const completion = await ai.client.chat.completions.create({
    model: ai.models.chat,
    messages,
    temperature: 0.8,
    max_tokens: 700,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'conversation_turn', strict: true, schema: TURN_SCHEMA },
    },
  })

  const content = completion.choices[0]?.message?.content
  if (!content) throw new AiError('The teacher returned an empty response.')

  let parsed: RawTurn
  try {
    parsed = JSON.parse(content) as RawTurn
  } catch {
    throw new AiError('The teacher response could not be read.')
  }

  return normalise(parsed)
}
