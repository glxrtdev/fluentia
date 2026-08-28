import 'server-only'

import type { AiClient } from '@/lib/ai'

/**
 * Text to speech.
 *
 * The provider decides the format — OpenAI streams mp3 as it is generated,
 * Gemini answers in one piece as PCM that its adapter wraps as WAV. Callers
 * read a stream either way and take the mime type from the client.
 */
export function speak(
  ai: AiClient,
  text: string,
  /** Auditioning a voice happens before it is saved, so it is passed in. */
  voice?: string,
): Promise<ReadableStream<Uint8Array>> {
  return ai.speak(text, voice)
}
