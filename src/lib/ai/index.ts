import 'server-only'

import { eq } from 'drizzle-orm'

import { decryptSecret } from '@/lib/crypto'
import { db } from '@/lib/db'
import { userSettings } from '@/lib/db/schema'

import { createGeminiClient } from './gemini'
import { createOpenAiClient, normaliseOpenAiError } from './openai'
import { getProvider, resolveVoice, type ProviderId } from './provider'
import { AiError, MissingApiKeyError, type AiClient } from './types'

export { AiError, MissingApiKeyError } from './types'
export type { AiClient } from './types'
export * from './provider'

/** The stored key and its model overrides, for whichever provider is chosen. */
type Row = typeof userSettings.$inferSelect

const cipherFor = (settings: Row, provider: ProviderId) =>
  provider === 'gemini' ? settings.geminiKeyCipher : settings.openaiKeyCipher

/**
 * Builds a client from the calling user's own key.
 *
 * The plaintext key only ever exists inside this request — it is never
 * returned to the browser, and never written anywhere.
 */
export async function getAiClient(userId: string): Promise<AiClient> {
  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1)

  const provider = getProvider(settings?.aiProvider)
  const cipher = settings ? cipherFor(settings, provider.id) : null
  if (!cipher) throw new MissingApiKeyError(provider.label)

  let apiKey: string
  try {
    apiKey = decryptSecret(cipher)
  } catch {
    throw new AiError('Sua chave guardada não pôde ser lida. Salve-a novamente.', 500)
  }

  /*
   * Model overrides are per provider in spirit but stored in one place, so a
   * model saved for OpenAI must not leak into a Gemini request. Anything that
   * is not a model of the chosen provider falls back to that provider's own
   * default rather than being sent and rejected.
   */
  const models = {
    chat: pickModel(settings.chatModel, provider.defaults.chat, provider.id),
    stt: pickModel(settings.sttModel, provider.defaults.stt, provider.id),
    tts: pickModel(settings.ttsModel, provider.defaults.tts, provider.id),
  }

  const voice = resolveVoice(provider.id, settings.voice)
  const config = { apiKey, models, voice }

  return provider.id === 'gemini' ? createGeminiClient(config) : createOpenAiClient(config)
}

/**
 * A saved model belongs to whichever provider it came from. `gpt-4o` sent to
 * Gemini is a 404 with a confusing message, so the mismatch is caught here.
 */
function pickModel(saved: string | null, fallback: string, provider: ProviderId): string {
  const value = saved?.trim()
  if (!value) return fallback
  const looksGemini = value.startsWith('gemini') || value.startsWith('models/gemini')
  const matches = provider === 'gemini' ? looksGemini : !looksGemini
  return matches ? value : fallback
}

/** Turns provider errors into messages that are safe and useful to show. */
export function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error
  if (error instanceof MissingApiKeyError) return new AiError(error.message, 428)

  const fromOpenAi = normaliseOpenAiError(error)
  if (fromOpenAi) return fromOpenAi

  return new AiError('Algo deu errado ao falar com o provedor de IA.', 502)
}
