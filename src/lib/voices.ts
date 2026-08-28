/**
 * The teacher's voices.
 *
 * Each provider names its own set — OpenAI has Alloy and Shimmer, Gemini has
 * Zephyr and Kore — so the list lives beside the provider in `lib/ai/provider`
 * and this module only adds the descriptions and the audition line.
 *
 * No `server-only` here on purpose: the picker is a client component.
 */
import { PROVIDERS, type ProviderId } from '@/lib/ai/provider'

/** A line of colour for the voices we can describe; the rest show their name. */
const DESCRIPTIONS: Record<string, string> = {
  alloy: 'Neutra e equilibrada. A padrão.',
  ash: 'Grave e firme.',
  ballad: 'Suave, sem pressa.',
  coral: 'Clara e encorajadora.',
  echo: 'Direta e objetiva.',
  sage: 'Calma, de professor.',
  shimmer: 'Calorosa e expressiva.',
  verse: 'Conversacional, com variação.',
  Zephyr: 'Leve e clara.',
  Puck: 'Animada e ágil.',
  Charon: 'Grave e pausada.',
  Kore: 'Firme e didática.',
  Fenrir: 'Cheia e marcante.',
  Leda: 'Jovem e brilhante.',
  Orus: 'Neutra e estável.',
  Aoede: 'Melódica e calorosa.',
}

export const voicesFor = (provider: ProviderId) =>
  PROVIDERS[provider].voices.map((voice) => ({
    ...voice,
    description: DESCRIPTIONS[voice.id] ?? '',
  }))

/** Every voice id across every provider, for validating a saved choice. */
export const VOICE_IDS = Object.values(PROVIDERS).flatMap((provider) =>
  provider.voices.map((voice) => voice.id),
) as [string, ...string[]]

export const isVoiceId = (value: string): boolean => VOICE_IDS.includes(value)

/**
 * What every voice says when you audition it. Short on purpose: each preview is
 * a text-to-speech call billed to the learner's own account.
 */
export const VOICE_SAMPLE = 'Oi! Vamos começar com algo simples?'
