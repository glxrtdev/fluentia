/**
 * The teacher's voices. Shared by the settings picker, the preview endpoint and
 * the validation schema, so there is one list rather than three that drift.
 *
 * No `server-only` here on purpose: the picker is a client component.
 */
export const VOICES = [
  { id: 'alloy', label: 'Alloy', description: 'Neutral and even. The default.' },
  { id: 'ash', label: 'Ash', description: 'Low and steady.' },
  { id: 'ballad', label: 'Ballad', description: 'Soft, unhurried.' },
  { id: 'coral', label: 'Coral', description: 'Bright and encouraging.' },
  { id: 'echo', label: 'Echo', description: 'Clear and matter-of-fact.' },
  { id: 'sage', label: 'Sage', description: 'Calm, teacherly.' },
  { id: 'shimmer', label: 'Shimmer', description: 'Warm and expressive.' },
  { id: 'verse', label: 'Verse', description: 'Conversational, with range.' },
] as const

export type VoiceId = (typeof VOICES)[number]['id']

export const VOICE_IDS = VOICES.map((voice) => voice.id) as unknown as [VoiceId, ...VoiceId[]]

export const isVoiceId = (value: string): value is VoiceId =>
  VOICES.some((voice) => voice.id === value)

/**
 * What every voice says when you audition it. Short on purpose: each preview is
 * a text-to-speech call billed to the learner's own OpenAI account.
 */
export const VOICE_SAMPLE = "Hi! I'm your English teacher. Shall we start with something simple?"
