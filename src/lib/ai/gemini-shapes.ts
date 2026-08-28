/**
 * The awkward parts of talking to Gemini, kept pure so they can be tested
 * without a key or a network.
 *
 * Two things genuinely differ from OpenAI and are easy to get quietly wrong:
 * the schema dialect, and the fact that Gemini returns raw samples rather than
 * an audio file.
 */

/**
 * Gemini's `responseSchema` is an OpenAPI 3.0 subset, not JSON Schema.
 *
 * It rejects `additionalProperties` outright — the very key OpenAI's strict
 * mode *requires* — and ignores several others. Rather than keep two copies of
 * every schema in sync, the app writes one JSON Schema and this strips it down
 * to what Gemini accepts.
 */
const GEMINI_KEYS = new Set([
  'type',
  'format',
  'description',
  'nullable',
  'enum',
  'items',
  'properties',
  'required',
  'propertyOrdering',
])

export function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema)
  if (!schema || typeof schema !== 'object') return schema

  const source = schema as Record<string, unknown>
  const out: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(source)) {
    if (!GEMINI_KEYS.has(key)) continue

    if (key === 'properties' && value && typeof value === 'object') {
      const properties: Record<string, unknown> = {}
      for (const [name, child] of Object.entries(value as Record<string, unknown>)) {
        properties[name] = toGeminiSchema(child)
      }
      out.properties = properties
      continue
    }

    out[key] = key === 'items' ? toGeminiSchema(value) : value
  }

  /*
   * A nullable field is `type: ['string', 'null']` in JSON Schema and
   * `nullable: true` in Gemini's dialect. Without this the model is told the
   * type is an array of names and answers with nonsense.
   */
  if (Array.isArray(out.type)) {
    const types = (out.type as string[]).filter((entry) => entry !== 'null')
    if ((out.type as string[]).includes('null')) out.nullable = true
    out.type = types[0] ?? 'string'
  }

  return out
}

/**
 * Wraps Gemini's raw PCM in a WAV header.
 *
 * Gemini answers speech requests with signed 16-bit little-endian samples and
 * no container — `audio/L16;codec=pcm;rate=24000`. A browser will not play
 * that. A 44-byte RIFF header makes it a playable file with no re-encoding and
 * no quality loss.
 */
export function pcmToWav(pcm: Uint8Array, sampleRate = 24_000, channels = 1): Uint8Array {
  const bitsPerSample = 16
  const blockAlign = (channels * bitsPerSample) / 8
  const byteRate = sampleRate * blockAlign

  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
  }

  ascii(0, 'RIFF')
  view.setUint32(4, 36 + pcm.length, true) // file size minus the first 8 bytes
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM header length
  view.setUint16(20, 1, true) // format 1 = PCM
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  ascii(36, 'data')
  view.setUint32(40, pcm.length, true)

  const out = new Uint8Array(44 + pcm.length)
  out.set(new Uint8Array(header), 0)
  out.set(pcm, 44)
  return out
}

/** Reads the sample rate out of `audio/L16;codec=pcm;rate=24000`. */
export function sampleRateFromMime(mime: string | undefined): number {
  const match = /rate=(\d+)/.exec(mime ?? '')
  const rate = match ? Number(match[1]) : Number.NaN
  return Number.isFinite(rate) && rate > 0 ? rate : 24_000
}

/** The text of a `generateContent` reply, or '' when the model returned none. */
export function textFromGemini(payload: unknown): string {
  const parts = (payload as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
    ?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts
    .map((part) => part?.text ?? '')
    .join('')
    .trim()
}

/** The inline audio of a speech reply: base64 data plus its declared mime. */
export function audioFromGemini(payload: unknown): { data: string; mime?: string } | null {
  const parts = (
    payload as {
      candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[]
    }
  )?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return null

  for (const part of parts) {
    const data = part?.inlineData?.data
    if (typeof data === 'string' && data.length > 0) {
      return { data, mime: part.inlineData?.mimeType }
    }
  }
  return null
}

/** Gemini reports model ids as `models/gemini-2.5-flash`; the app wants the tail. */
export const stripModelPrefix = (name: string) => name.replace(/^models\//, '')
