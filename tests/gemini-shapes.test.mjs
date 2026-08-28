import { test } from 'node:test'
import assert from 'node:assert/strict'

const { toGeminiSchema, pcmToWav, sampleRateFromMime, textFromGemini, audioFromGemini, stripModelPrefix } =
  await import('../src/lib/ai/gemini-shapes.ts')

/* ------------------------------------------------------- schema conversion */

test('the key OpenAI requires is the key Gemini rejects', () => {
  // `additionalProperties: false` is mandatory for OpenAI strict mode and
  // fatal for Gemini. Sending one schema to both is only possible if it goes.
  const out = toGeminiSchema({
    type: 'object',
    additionalProperties: false,
    required: ['reply'],
    properties: { reply: { type: 'string' } },
  })
  assert.equal('additionalProperties' in out, false)
  assert.deepEqual(out.required, ['reply'])
})

test('nesting is converted all the way down', () => {
  const out = toGeminiSchema({
    type: 'object',
    additionalProperties: false,
    properties: {
      corrections: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: { original: { type: 'string' } },
        },
      },
    },
  })
  const item = out.properties.corrections.items
  assert.equal('additionalProperties' in item, false)
  assert.equal(item.properties.original.type, 'string')
})

test('what Gemini does understand survives untouched', () => {
  const out = toGeminiSchema({
    type: 'string',
    description: 'One short sentence.',
    enum: ['a', 'b'],
    format: 'date-time',
  })
  assert.deepEqual(out, {
    type: 'string',
    description: 'One short sentence.',
    enum: ['a', 'b'],
    format: 'date-time',
  })
})

test('a nullable union becomes the flag Gemini expects', () => {
  // JSON Schema says type: ['integer','null']; Gemini says nullable: true.
  // Left alone, the model is told its type is a list of names.
  const out = toGeminiSchema({ type: ['integer', 'null'] })
  assert.equal(out.type, 'integer')
  assert.equal(out.nullable, true)
})

test('the real turn schema converts without losing its shape', async () => {
  const { TURN_SCHEMA } = await import('../src/lib/openai/schemas.ts')
  const out = toGeminiSchema(TURN_SCHEMA)

  assert.deepEqual(Object.keys(out.properties).sort(), ['corrections', 'level_signal', 'reply'])
  assert.ok(out.required.includes('reply'))
  assert.ok(!JSON.stringify(out).includes('additionalProperties'))
  assert.equal(out.properties.corrections.items.properties.category.type, 'string')
  assert.ok(Array.isArray(out.properties.corrections.items.properties.category.enum))
})

test('junk does not throw', () => {
  for (const value of [null, undefined, 42, 'x', [], {}]) {
    assert.doesNotThrow(() => toGeminiSchema(value))
  }
})

/* ------------------------------------------------------------------- audio */

test('the WAV header describes the samples it wraps', () => {
  const pcm = new Uint8Array(1000)
  const wav = pcmToWav(pcm, 24_000, 1)
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength)
  const ascii = (at, length) =>
    String.fromCharCode(...Array.from({ length }, (_, i) => view.getUint8(at + i)))

  assert.equal(ascii(0, 4), 'RIFF')
  assert.equal(ascii(8, 4), 'WAVE')
  assert.equal(ascii(12, 4), 'fmt ')
  assert.equal(ascii(36, 4), 'data')
  assert.equal(view.getUint16(20, true), 1, 'format must be PCM')
  assert.equal(view.getUint16(22, true), 1, 'one channel')
  assert.equal(view.getUint32(24, true), 24_000, 'sample rate')
  assert.equal(view.getUint32(28, true), 48_000, 'byte rate = rate × blockAlign')
  assert.equal(view.getUint16(32, true), 2, 'block align for 16-bit mono')
  assert.equal(view.getUint16(34, true), 16, 'bits per sample')
  assert.equal(view.getUint32(40, true), pcm.length, 'data size')
  assert.equal(view.getUint32(4, true), 36 + pcm.length, 'RIFF size')
  assert.equal(wav.length, 44 + pcm.length)
})

test('the samples themselves are copied through unchanged', () => {
  const pcm = Uint8Array.from([1, 2, 3, 4, 250, 251])
  const wav = pcmToWav(pcm)
  assert.deepEqual(Array.from(wav.slice(44)), Array.from(pcm))
})

test('the sample rate comes from what Gemini declared', () => {
  assert.equal(sampleRateFromMime('audio/L16;codec=pcm;rate=24000'), 24_000)
  assert.equal(sampleRateFromMime('audio/L16;codec=pcm;rate=16000'), 16_000)
  // A missing or nonsensical rate must not produce a NaN-length header.
  assert.equal(sampleRateFromMime(undefined), 24_000)
  assert.equal(sampleRateFromMime('audio/L16'), 24_000)
  assert.equal(sampleRateFromMime('audio/L16;rate=0'), 24_000)
})

/* --------------------------------------------------------- reply unpacking */

test('text is read out of a generateContent reply', () => {
  assert.equal(
    textFromGemini({ candidates: [{ content: { parts: [{ text: '  olá  ' }] } }] }),
    'olá',
  )
  // Gemini may split one answer across several parts.
  assert.equal(
    textFromGemini({ candidates: [{ content: { parts: [{ text: '{"a":' }, { text: '1}' }] } }] }),
    '{"a":1}',
  )
})

test('an empty or blocked reply reads as empty, not as a crash', () => {
  for (const value of [{}, { candidates: [] }, { candidates: [{}] }, null, 'nope']) {
    assert.doesNotThrow(() => textFromGemini(value))
    assert.equal(textFromGemini(value), '')
  }
})

test('inline audio is found beside other parts', () => {
  const found = audioFromGemini({
    candidates: [
      {
        content: {
          parts: [
            { text: 'ignored' },
            { inlineData: { mimeType: 'audio/L16;rate=24000', data: 'AAAA' } },
          ],
        },
      },
    ],
  })
  assert.equal(found.data, 'AAAA')
  assert.equal(found.mime, 'audio/L16;rate=24000')
})

test('a reply with no audio is null, so the caller can say so', () => {
  assert.equal(audioFromGemini({ candidates: [{ content: { parts: [{ text: 'x' }] } }] }), null)
  assert.equal(audioFromGemini(null), null)
})

test('model ids lose the prefix Gemini adds', () => {
  assert.equal(stripModelPrefix('models/gemini-2.5-flash'), 'gemini-2.5-flash')
  assert.equal(stripModelPrefix('gemini-2.5-flash'), 'gemini-2.5-flash')
})
