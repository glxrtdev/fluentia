import 'server-only'

import { eq } from 'drizzle-orm'
import OpenAI from 'openai'

import { decryptSecret } from '@/lib/crypto'
import { db } from '@/lib/db'
import { userSettings } from '@/lib/db/schema'

export const DEFAULT_MODELS = {
  chat: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o',
  stt: process.env.OPENAI_STT_MODEL ?? 'gpt-4o-transcribe',
  tts: process.env.OPENAI_TTS_MODEL ?? 'gpt-4o-mini-tts',
} as const

/** Thrown when the user has not saved an OpenAI key yet. */
export class MissingApiKeyError extends Error {
  constructor() {
    super('Add your OpenAI API key in Settings to start speaking.')
    this.name = 'MissingApiKeyError'
  }
}

/** Any failure coming back from OpenAI, normalised for the UI. */
export class AiError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.name = 'AiError'
    this.status = status
  }
}

export type UserAi = {
  client: OpenAI
  models: { chat: string; stt: string; tts: string }
  voice: string
}

/**
 * Builds an OpenAI client from the calling user's own key. The plaintext key
 * only ever exists inside this request — it is never returned to the browser.
 */
export function getUserAi(userId: string): UserAi {
  const settings = db.select().from(userSettings).where(eq(userSettings.userId, userId)).get()
  if (!settings?.openaiKeyCipher) throw new MissingApiKeyError()

  let apiKey: string
  try {
    apiKey = decryptSecret(settings.openaiKeyCipher)
  } catch {
    throw new AiError('Your stored API key could not be read. Please save it again.', 500)
  }

  return {
    client: new OpenAI({
      apiKey,
      maxRetries: 1,
      timeout: 90_000,
      // Lets the app point at an OpenAI-compatible gateway (or a test double).
      ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
    }),
    models: {
      chat: settings.chatModel || DEFAULT_MODELS.chat,
      stt: settings.sttModel || DEFAULT_MODELS.stt,
      tts: settings.ttsModel || DEFAULT_MODELS.tts,
    },
    voice: settings.voice || 'alloy',
  }
}

/** Turns SDK errors into messages that are safe and useful to show. */
export function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error
  if (error instanceof MissingApiKeyError) return new AiError(error.message, 428)

  if (error instanceof OpenAI.APIError) {
    if (error.status === 401) {
      return new AiError('OpenAI rejected your API key. Check it in Settings.', 401)
    }
    if (error.status === 429) {
      return new AiError(
        'Your OpenAI account hit a rate limit or has no available quota.',
        429,
      )
    }
    if (error.status === 400) {
      return new AiError(error.message || 'OpenAI rejected the request.', 400)
    }
    return new AiError('OpenAI is not responding right now. Try again in a moment.', 502)
  }

  return new AiError('Something went wrong talking to OpenAI.', 502)
}
