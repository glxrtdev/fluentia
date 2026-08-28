/**
 * What Fluentia needs from an AI provider.
 *
 * The app leans on exactly three capabilities: it has to **hear** (speech to
 * text), **think** (a chat reply plus corrections, constrained by a JSON
 * schema), and **speak** (text to speech). A provider is only offered here if
 * it does all three on its own — a learner should never have to hold two
 * accounts to finish one conversation.
 *
 * That rule is what keeps Anthropic off the list: Claude reasons well and
 * supports structured output, but its API takes text, images and PDFs and
 * returns text. It cannot hear or speak, so a Claude workspace would still
 * need OpenAI or Gemini underneath it.
 *
 * Pure types and data — no SDKs, no network — so it is safe to import from the
 * browser for the settings UI.
 */

export const PROVIDER_IDS = ['openai', 'gemini'] as const
export type ProviderId = (typeof PROVIDER_IDS)[number]

export type ModelRole = 'chat' | 'stt' | 'tts'

export type ProviderInfo = {
  id: ProviderId
  label: string
  /** Where the learner goes to create a key. */
  keyUrl: string
  /**
   * How a key from this provider starts.
   *
   * The point of checking at all is to catch a key pasted into the wrong
   * provider's box, not to fully validate it — the live verification call does
   * that. So the rule stays deliberately loose: rejecting a real key is a much
   * worse failure than letting a typo through, and providers add new key
   * formats without warning.
   */
  keyPrefixes: string[]
  keyPattern: RegExp
  defaults: Record<ModelRole, string>
  voices: { id: string; label: string }[]
  /** Audio this provider's speech endpoint returns, for the response header. */
  audioMime: string
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyPrefixes: ['sk-'],
    keyPattern: /^sk-[A-Za-z0-9._-]{20,}$/,
    defaults: { chat: 'gpt-4o', stt: 'gpt-4o-transcribe', tts: 'gpt-4o-mini-tts' },
    voices: [
      { id: 'alloy', label: 'Alloy' },
      { id: 'ash', label: 'Ash' },
      { id: 'ballad', label: 'Ballad' },
      { id: 'coral', label: 'Coral' },
      { id: 'echo', label: 'Echo' },
      { id: 'sage', label: 'Sage' },
      { id: 'shimmer', label: 'Shimmer' },
      { id: 'verse', label: 'Verse' },
    ],
    audioMime: 'audio/mpeg',
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    keyUrl: 'https://aistudio.google.com/apikey',
    /*
     * Two live formats. `AIza` is the long-standing Google API key; `AQ.` is
     * the newer AI Studio auth key, and it contains dots — a character the
     * previous pattern rejected outright, so a valid new key was refused as
     * "not a Gemini key".
     */
    keyPrefixes: ['AIza', 'AQ.'],
    keyPattern: /^(AIza[A-Za-z0-9._-]{20,}|AQ\.[A-Za-z0-9._-]{15,})$/,
    defaults: {
      chat: 'gemini-2.5-flash',
      stt: 'gemini-2.5-flash',
      tts: 'gemini-2.5-flash-preview-tts',
    },
    /*
     * Gemini's prebuilt voices. The names are its own; they are not the same
     * set as OpenAI's, which is why the voice lives beside the provider rather
     * than in one shared list.
     */
    voices: [
      { id: 'Zephyr', label: 'Zephyr' },
      { id: 'Puck', label: 'Puck' },
      { id: 'Charon', label: 'Charon' },
      { id: 'Kore', label: 'Kore' },
      { id: 'Fenrir', label: 'Fenrir' },
      { id: 'Leda', label: 'Leda' },
      { id: 'Orus', label: 'Orus' },
      { id: 'Aoede', label: 'Aoede' },
    ],
    /*
     * Gemini returns raw PCM rather than a container format, so the adapter
     * wraps it in a WAV header before it reaches the browser. Cheap — a 44-byte
     * prefix, no re-encoding.
     */
    audioMime: 'audio/wav',
  },
}

/**
 * What to tell someone about the shape, written from the prefixes themselves.
 *
 * Derived rather than stored: a hint that says "sk-" beside a pattern that
 * wants "AIza" is the same bug in different clothes.
 *
 * Each prefix trails an ellipsis, and the sentence ends on one. That is not
 * decoration: `AQ.` ends in a dot, so a full stop after it would render as
 * "AQ.." and leave the reader guessing which dot belongs to the key.
 */
export function keyHint(provider: ProviderInfo): string {
  const shown = provider.keyPrefixes.map((prefix) => `${prefix}…`)
  const last = shown.at(-1)!
  const label = shown.length === 1 ? last : `${shown.slice(0, -1).join(', ')} ou ${last}`
  return `Formatos aceitos: ${label}`
}

export const isProviderId = (value: unknown): value is ProviderId =>
  typeof value === 'string' && (PROVIDER_IDS as readonly string[]).includes(value)

/** Never throws: an unknown id falls back to OpenAI rather than a blank page. */
export const getProvider = (id: string | null | undefined): ProviderInfo =>
  PROVIDERS[id as ProviderId] ?? PROVIDERS.openai

/** The voice a provider should use when none is chosen, or the saved one is another provider's. */
export function resolveVoice(provider: ProviderId, saved: string | null | undefined): string {
  const voices = PROVIDERS[provider].voices
  return voices.some((voice) => voice.id === saved) ? saved! : voices[0].id
}
