import 'server-only'

import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

import { PROVIDERS } from './provider'
import { AiError, type AiClient, type ChatJsonArgs, type ChatTextArgs } from './types'

const VOICE_INSTRUCTIONS =
  'Warm, patient language teacher. Natural conversational pace, clear articulation, ' +
  'friendly and encouraging. Never sound like a narrator reading a script.'

/**
 * OpenAI, behind the shared interface.
 *
 * A faithful port of what the app already did — same models, same streaming,
 * same strict JSON schema — moved behind `AiClient` so a second provider can
 * stand beside it instead of replacing it.
 */
export function createOpenAiClient(args: {
  apiKey: string
  models: { chat: string; stt: string; tts: string }
  voice: string
}): AiClient {
  const client = new OpenAI({
    apiKey: args.apiKey,
    maxRetries: 1,
    timeout: 90_000,
    // Lets the app point at an OpenAI-compatible gateway (or a test double).
    ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
  })

  return {
    provider: 'openai',
    models: args.models,
    voice: args.voice,

    async transcribe(audio, language) {
      const result = await client.audio.transcriptions.create({
        file: audio,
        model: args.models.stt,
        // Naming the language stops the model guessing, which it does badly on
        // a learner's accented speech.
        language,
        prompt: 'A student practising this language out loud in a conversation with their teacher.',
        response_format: 'json',
      })
      return (result.text ?? '').trim()
    },

    async chatJson({ system, messages, schema, schemaName, maxTokens, temperature }: ChatJsonArgs) {
      const payload: ChatCompletionMessageParam[] = [
        { role: 'system', content: system },
        ...messages.map((message) => ({ role: message.role, content: message.content }) as const),
      ]

      const completion = await client.chat.completions.create({
        model: args.models.chat,
        messages: payload,
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens ?? 900,
        response_format: {
          type: 'json_schema',
          json_schema: { name: schemaName, strict: true, schema },
        },
      })

      const content = completion.choices[0]?.message?.content
      if (!content) throw new AiError('O provedor não devolveu nenhuma resposta.', 502)
      return JSON.parse(content)
    },

    async chatText({ system, user, maxTokens, temperature }: ChatTextArgs) {
      const completion = await client.chat.completions.create({
        model: args.models.chat,
        temperature: temperature ?? 0.2,
        max_tokens: maxTokens ?? 120,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      })
      return (completion.choices[0]?.message?.content ?? '').trim()
    },

    async speak(text, voice) {
      const response = await client.audio.speech.create({
        model: args.models.tts,
        voice: voice || args.voice,
        input: text.slice(0, 4000),
        response_format: 'mp3',
        // `instructions` is ignored by tts-1 and honoured by gpt-4o-mini-tts.
        ...(args.models.tts.startsWith('gpt-4o') ? { instructions: VOICE_INSTRUCTIONS } : {}),
      })

      const body = response.body
      if (!body) throw new AiError('Nenhum áudio foi devolvido.', 502)
      return body as ReadableStream<Uint8Array>
    },

    async listModels() {
      const page = await client.models.list()
      return page.data.map((model) => model.id)
    },

    async verify() {
      await client.models.list()
    },
  }
}

/** Turns OpenAI SDK errors into messages that are safe and useful to show. */
export function normaliseOpenAiError(error: unknown): AiError | null {
  if (!(error instanceof OpenAI.APIError)) return null

  const label = PROVIDERS.openai.label
  if (error.status === 401) {
    return new AiError(`A ${label} recusou sua chave. Confira nas Configurações.`, 401)
  }
  if (error.status === 429) {
    return new AiError(`Sua conta da ${label} atingiu um limite ou está sem cota.`, 429)
  }
  if (error.status === 400) {
    return new AiError(error.message || `A ${label} recusou a requisição.`, 400)
  }
  return new AiError(`A ${label} não está respondendo agora. Tente em instantes.`, 502)
}
