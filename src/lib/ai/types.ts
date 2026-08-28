import type { ModelRole, ProviderId } from './provider'

/** A turn of the conversation as the app hands it to a provider. */
export type AiMessage = { role: 'user' | 'assistant'; content: string }

export type ChatJsonArgs = {
  system: string
  messages: AiMessage[]
  /** A JSON Schema the reply must satisfy. Adapters translate it as needed. */
  schema: Record<string, unknown>
  schemaName: string
  maxTokens?: number
  temperature?: number
}

export type ChatTextArgs = {
  system: string
  user: string
  maxTokens?: number
  temperature?: number
}

/**
 * Everything Fluentia asks of a provider, and nothing more.
 *
 * Narrow on purpose: the surface a second provider has to implement is four
 * methods, not an SDK. Each one is a capability the app genuinely uses, so a
 * provider that cannot fill one cannot be offered at all.
 */
export type AiClient = {
  provider: ProviderId
  models: Record<ModelRole, string>
  voice: string

  /** Audio in, text out. `language` is an ISO-639-1 code. */
  transcribe(audio: File, language: string): Promise<string>

  /** A reply constrained by a JSON schema. Returns the parsed object. */
  chatJson(args: ChatJsonArgs): Promise<unknown>

  /** A short free-text reply, for translations. */
  chatText(args: ChatTextArgs): Promise<string>

  /** Text in, streamed audio out, in this provider's `audioMime`. */
  speak(text: string, voice?: string): Promise<ReadableStream<Uint8Array>>

  /** Model ids this account can reach, for the settings pickers. */
  listModels(): Promise<string[]>

  /** Cheapest call that proves the key works. Throws when it does not. */
  verify(): Promise<void>
}

/** Any failure coming back from a provider, normalised for the UI. */
export class AiError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.name = 'AiError'
    this.status = status
  }
}

/** Thrown when the user has not saved a key for the chosen provider. */
export class MissingApiKeyError extends Error {
  constructor(providerLabel: string) {
    super(`Adicione sua chave da ${providerLabel} nas Configurações para começar a falar.`)
    this.name = 'MissingApiKeyError'
  }
}
