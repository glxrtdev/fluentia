import 'server-only'

import { PROVIDERS } from './provider'
import {
  audioFromGemini,
  pcmToWav,
  sampleRateFromMime,
  stripModelPrefix,
  textFromGemini,
  toGeminiSchema,
} from './gemini-shapes'
import { AiError, type AiClient, type ChatJsonArgs, type ChatTextArgs } from './types'

const BASE = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta'
const TIMEOUT_MS = 90_000

const VOICE_INSTRUCTIONS =
  'Read this as a warm, patient language teacher would: natural conversational pace, ' +
  'clear articulation, friendly and encouraging.'

type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } }

/**
 * Google Gemini, behind the shared interface.
 *
 * Gemini has no separate transcription or speech endpoint — everything is
 * `generateContent`, distinguished by what goes in and what modality is asked
 * for back. Audio in is an inline blob beside a prompt; audio out is raw PCM
 * that this adapter wraps as WAV before the browser sees it.
 */
export function createGeminiClient(args: {
  apiKey: string
  models: { chat: string; stt: string; tts: string }
  voice: string
}): AiClient {
  async function call(model: string, body: unknown): Promise<unknown> {
    let response: Response
    try {
      response = await fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // The header form, so the key never lands in a URL that might be logged.
          'x-goog-api-key': args.apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch {
      throw new AiError('O Gemini não está respondendo agora. Tente em instantes.', 502)
    }

    if (!response.ok) throw geminiError(response.status, await response.text())
    try {
      return await response.json()
    } catch {
      throw new AiError('O Gemini devolveu algo ilegível.', 502)
    }
  }

  return {
    provider: 'gemini',
    models: args.models,
    voice: args.voice,

    async transcribe(audio, language) {
      /*
       * Google documents WAV, MP3, AIFF, AAC, OGG Vorbis and FLAC — and not
       * WebM/Opus, which is what Chrome and Edge record. The recording is sent
       * as captured rather than guessing at a conversion that would need a
       * codec on the server; if Google refuses it, the error below says so in
       * plain terms instead of failing as an opaque 400.
       */
      const base64 = Buffer.from(await audio.arrayBuffer()).toString('base64')
      const payload = await call(args.models.stt, {
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: audio.type || 'audio/webm', data: base64 } },
              {
                text:
                  `Transcribe this audio exactly as spoken, in ${language}. ` +
                  'It is a student practising the language out loud. ' +
                  'Reply with the transcript only — no quotes, no commentary, no timestamps. ' +
                  'If nothing intelligible was said, reply with an empty string.',
              },
            ] satisfies GeminiPart[],
          },
        ],
        generationConfig: { temperature: 0 },
      })
      return textFromGemini(payload)
    },

    async chatJson({ system, messages, schema, maxTokens, temperature }: ChatJsonArgs) {
      const payload = await call(args.models.chat, {
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((message) => ({
          // Gemini calls the assistant "model".
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }],
        })),
        generationConfig: {
          temperature: temperature ?? 0.7,
          maxOutputTokens: maxTokens ?? 900,
          responseMimeType: 'application/json',
          responseSchema: toGeminiSchema(schema),
        },
      })

      const text = textFromGemini(payload)
      if (!text) throw new AiError('O Gemini não devolveu nenhuma resposta.', 502)
      try {
        return JSON.parse(text)
      } catch {
        throw new AiError('O Gemini devolveu um JSON inválido.', 502)
      }
    },

    async chatText({ system, user, maxTokens, temperature }: ChatTextArgs) {
      const payload = await call(args.models.chat, {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          temperature: temperature ?? 0.2,
          maxOutputTokens: maxTokens ?? 120,
        },
      })
      return textFromGemini(payload)
    },

    async speak(text, voice) {
      const payload = await call(args.models.tts, {
        contents: [
          { role: 'user', parts: [{ text: `${VOICE_INSTRUCTIONS}\n\n${text.slice(0, 4000)}` }] },
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || args.voice } },
          },
        },
      })

      const audio = audioFromGemini(payload)
      if (!audio) throw new AiError('Nenhum áudio foi devolvido.', 502)

      const wav = pcmToWav(
        Buffer.from(audio.data, 'base64'),
        sampleRateFromMime(audio.mime),
      )

      /*
       * Gemini answers in one piece rather than streaming, so this is a stream
       * of exactly one chunk. The route reads it the same way either way.
       */
      return new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(wav)
          controller.close()
        },
      })
    },

    async listModels() {
      let response: Response
      try {
        response = await fetch(`${BASE}/models?pageSize=200`, {
          headers: { 'x-goog-api-key': args.apiKey },
          signal: AbortSignal.timeout(15_000),
        })
      } catch {
        return []
      }
      if (!response.ok) return []

      const payload = (await response.json()) as { models?: { name?: string }[] }
      return (payload.models ?? [])
        .map((model) => stripModelPrefix(model.name ?? ''))
        .filter(Boolean)
    },

    async verify() {
      const response = await fetch(`${BASE}/models?pageSize=1`, {
        headers: { 'x-goog-api-key': args.apiKey },
        signal: AbortSignal.timeout(15_000),
      })
      if (!response.ok) throw geminiError(response.status, await response.text())
    },
  }
}

/** Google's error bodies vary; only the status is reliable enough to branch on. */
function geminiError(status: number, body: string): AiError {
  const label = PROVIDERS.gemini.label

  /*
   * The one refusal worth naming precisely: an unsupported recording format is
   * a fixable problem, and "requisição recusada" would send the learner
   * looking at their key instead.
   */
  if (/mime|unsupported|not supported/i.test(body) && /audio/i.test(body)) {
    return new AiError(
      `O ${label} não aceitou o formato do seu áudio. Isso é limitação do provedor, não da sua chave — ` +
        'use a OpenAI para este idioma ou me avise para eu converter a gravação.',
      415,
    )
  }
  if (status === 400 && /API key not valid/i.test(body)) {
    return new AiError(`O ${label} recusou sua chave. Confira nas Configurações.`, 401)
  }
  if (status === 401 || status === 403) {
    return new AiError(`O ${label} recusou sua chave. Confira nas Configurações.`, 401)
  }
  if (status === 429) {
    return new AiError(`Sua conta do ${label} atingiu um limite ou está sem cota.`, 429)
  }
  if (status === 400) {
    return new AiError(`O ${label} recusou a requisição.`, 400)
  }
  return new AiError(`O ${label} não está respondendo agora. Tente em instantes.`, 502)
}
