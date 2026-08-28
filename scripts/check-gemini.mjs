/**
 * Proves a real Gemini key does all three jobs, against Google itself.
 *
 * The wire test uses a stand-in, which shows the app is internally consistent
 * but cannot show that Google accepts these shapes. This does — one call per
 * capability, so a failure names which one broke instead of "it didn't work".
 *
 * Two of these checks exist because the published docs left the answer open:
 *
 *  - Google lists WAV, MP3, AIFF, AAC, OGG Vorbis and FLAC as accepted audio,
 *    and **not** WebM/Opus — which is exactly what a browser records on Chrome
 *    and Edge. Check 3 sends a real WebM recording to settle it.
 *  - The speech request shape is documented inconsistently across pages, so
 *    check 4 sends the shape the app actually uses.
 *
 *   node --env-file-if-exists=.env.local scripts/check-gemini.mjs <sua-chave> [gravacao.webm]
 *
 * A chave serve nos dois formatos do Google: a antiga `AIza...` e a nova auth
 * key do AI Studio, que começa com `AQ.` — as duas viajam no mesmo header.
 */
import { readFileSync } from 'node:fs'

const key = process.argv[2] || process.env.GEMINI_API_KEY
const recording = process.argv[3]

if (!key) {
  console.error('Uso: node scripts/check-gemini.mjs <sua-chave> [gravacao.webm]')
  console.error('     A chave pode ser do formato antigo (AIza...) ou da nova auth key (AQ....)')
  process.exit(1)
}

const BASE = 'https://generativelanguage.googleapis.com/v1beta'
let failures = 0
const record = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

const call = async (model, body) => {
  const response = await fetch(`${BASE}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`${response.status}: ${text.slice(0, 260)}`)
  return JSON.parse(text)
}

const { toGeminiSchema, audioFromGemini, textFromGemini, pcmToWav } = await import(
  '../src/lib/ai/gemini-shapes.ts'
)
const { TURN_SCHEMA } = await import('../src/lib/openai/schemas.ts')

/* 1 — the key itself ------------------------------------------------------ */
try {
  const response = await fetch(`${BASE}/models?pageSize=1`, { headers: { 'x-goog-api-key': key } })
  record('1. a chave é aceita', response.ok, response.ok ? '' : `status ${response.status}`)
} catch (error) {
  record('1. a chave é aceita', false, error.message)
}

/* 2 — think: the teacher schema in Gemini's dialect ----------------------- */
try {
  const payload = await call('gemini-2.5-flash', {
    systemInstruction: { parts: [{ text: 'You are a friendly English teacher.' }] },
    contents: [{ role: 'user', parts: [{ text: 'Say hello and ask one question.' }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: toGeminiSchema(TURN_SCHEMA),
      maxOutputTokens: 300,
    },
  })
  const parsed = JSON.parse(textFromGemini(payload))
  record('2. PENSAR — o schema do professor é aceito', Boolean(parsed.reply), parsed.reply ?? '')
} catch (error) {
  record('2. PENSAR — o schema do professor é aceito', false, error.message)
}

/* 3 — hear ---------------------------------------------------------------- */

/** A second of quiet WAV, in a format Google explicitly documents. */
const silentWav = pcmToWav(new Uint8Array(24_000 * 2), 24_000)

try {
  await call('gemini-2.5-flash', {
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'audio/wav', data: Buffer.from(silentWav).toString('base64') } },
          { text: 'Transcribe this audio. Reply with the transcript only.' },
        ],
      },
    ],
    generationConfig: { temperature: 0 },
  })
  record('3. OUVIR — áudio inline é aceito (wav)', true)
} catch (error) {
  record('3. OUVIR — áudio inline é aceito (wav)', false, error.message)
}

/*
 * The one the docs do not answer: a browser recording. Pass a real `.webm`
 * captured by the app to settle it — without one, this is reported as unknown
 * rather than quietly assumed to work.
 */
if (recording) {
  try {
    const bytes = readFileSync(recording)
    const mime = recording.endsWith('.ogg')
      ? 'audio/ogg'
      : recording.endsWith('.mp4')
        ? 'audio/mp4'
        : 'audio/webm'
    const payload = await call('gemini-2.5-flash', {
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: mime, data: bytes.toString('base64') } },
            { text: 'Transcribe this audio. Reply with the transcript only.' },
          ],
        },
      ],
      generationConfig: { temperature: 0 },
    })
    record(
      `3b. OUVIR — o formato do navegador (${mime}) é aceito`,
      true,
      `transcreveu: "${textFromGemini(payload).slice(0, 60)}"`,
    )
  } catch (error) {
    record('3b. OUVIR — o formato do navegador é aceito', false, error.message)
  }
} else {
  console.log(
    'SKIP  3b. OUVIR — formato do navegador: passe um arquivo .webm gravado pelo app\n' +
      '            para confirmar. O Google não documenta WebM/Opus como suportado.',
  )
}

/* 4 — speak --------------------------------------------------------------- */
try {
  const payload = await call('gemini-2.5-flash-preview-tts', {
    contents: [{ role: 'user', parts: [{ text: 'Hello! Shall we start?' }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
    },
  })
  const audio = audioFromGemini(payload)
  record(
    '4. FALAR — a fala é gerada, na forma que o app envia',
    Boolean(audio),
    audio ? `${audio.mime}` : 'resposta sem áudio',
  )
} catch (error) {
  record('4. FALAR — a fala é gerada, na forma que o app envia', false, error.message)
}

console.log(
  failures === 0
    ? '\nTudo certo — sua chave do Gemini faz ouvir, pensar e falar sozinha.'
    : `\n${failures} verificação(ões) falhou(aram). Me mande esta saída e eu ajusto o adaptador.`,
)
process.exitCode = failures === 0 ? 0 : 1
