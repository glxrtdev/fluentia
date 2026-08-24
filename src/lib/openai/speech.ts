import 'server-only'

import type { UserAi } from './client'

const VOICE_INSTRUCTIONS =
  'Warm, patient English teacher. Natural conversational pace, clear articulation, ' +
  'friendly and encouraging. Never sound like a narrator reading a script.'

/**
 * Text to speech, streamed straight through to the browser so the teacher
 * starts talking before the whole clip is generated.
 */
export async function speak(
  ai: UserAi,
  text: string,
  /** Auditioning a voice happens before it is saved, so it is passed in. */
  voice?: string,
): Promise<ReadableStream<Uint8Array>> {
  const response = await ai.client.audio.speech.create({
    model: ai.models.tts,
    voice: voice || ai.voice,
    input: text.slice(0, 4000),
    response_format: 'mp3',
    // `instructions` is ignored by the older tts-1 models and honoured by gpt-4o-mini-tts.
    ...(ai.models.tts.startsWith('gpt-4o') ? { instructions: VOICE_INSTRUCTIONS } : {}),
  })

  const body = response.body
  if (!body) throw new Error('No audio stream returned.')
  return body as ReadableStream<Uint8Array>
}
