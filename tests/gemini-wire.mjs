/**
 * The Gemini adapter, driven end to end against a stand-in for Google.
 *
 * This is the part `gemini-shapes.test.mjs` cannot reach: that the app builds
 * the request Gemini expects, and reads back what Gemini returns. The double
 * asserts on what it *receives* — the header the key travels in, the schema
 * dialect, the audio modality — so a wrong request fails here rather than
 * silently in production.
 *
 * It cannot prove Google accepts these shapes; only a real key does that, and
 * `npm run test:gemini:live` is for exactly that. What it does prove is that
 * the app is internally consistent and that the OpenAI path is untouched.
 */
import { createServer } from 'node:http'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { FAKE_GEMINI_KEY } from './fake-keys.mjs'

import { createCipheriv } from 'node:crypto'

const base = process.argv[2] ?? 'http://localhost:3100'
const mockPort = Number(process.argv[3] ?? 4320)

function encryptSecret(plaintext) {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new Error('ENCRYPTION_KEY missing — run with --env-file-if-exists=.env.local')
  const key = /^[0-9a-f]{64}$/i.test(raw)
    ? Buffer.from(raw, 'hex')
    : createHash('sha256').update(raw).digest()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), encrypted].map((b) => b.toString('base64')).join('.')
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} })

let failures = 0
const record = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

/** Every request the app made, so the shapes can be asserted afterwards. */
const seen = []

const mock = createServer((request, response) => {
  const chunks = []
  request.on('data', (chunk) => chunks.push(chunk))
  request.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8')
    const body = raw ? JSON.parse(raw) : null
    seen.push({ url: request.url, apiKey: request.headers['x-goog-api-key'], body })

    const json = (payload) => {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify(payload))
    }

    if (request.url?.startsWith('/models?')) {
      return json({ models: [{ name: 'models/gemini-2.5-flash' }, { name: 'models/gemini-2.5-pro' }] })
    }

    const wantsAudio = body?.generationConfig?.responseModalities?.includes('AUDIO')
    if (wantsAudio) {
      // 480 bytes of silence, exactly as Gemini sends it: raw 16-bit PCM.
      const pcm = Buffer.alloc(480)
      return json({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'audio/L16;codec=pcm;rate=24000',
                    data: pcm.toString('base64'),
                  },
                },
              ],
            },
          },
        ],
      })
    }

    const hasAudioIn = JSON.stringify(body?.contents ?? '').includes('inlineData')
    if (hasAudioIn) {
      return json({ candidates: [{ content: { parts: [{ text: 'I went out with my friends.' }] } }] })
    }

    // A schema-constrained reply: the teacher turn.
    const turn = {
      reply: 'That sounds good. What did you do next?',
      corrections: [],
      level_signal: 'right',
    }
    return json({ candidates: [{ content: { parts: [{ text: JSON.stringify(turn) }] } }] })
  })
})

const userId = randomUUID()
const workspaceId = randomUUID()
const token = randomBytes(32).toString('base64url')
const conversationId = randomUUID()

async function seed() {
  await sql`insert into users (id, email, name, password_hash)
            values (${userId}, ${`gem-${Date.now()}@fluentia.test`}, 'Enzo', 'x')`
  await sql`insert into profiles (user_id, onboarded_at) values (${userId}, now())`
  await sql`insert into workspaces (id, user_id, language, level)
            values (${workspaceId}, ${userId}, 'en', 'intermediate')`
  await sql`
    insert into user_settings (user_id, active_workspace_id, ai_provider,
                               gemini_key_cipher, gemini_key_hint, gemini_key_status, voice)
    values (${userId}, ${workspaceId}, 'gemini',
            ${encryptSecret(FAKE_GEMINI_KEY)}, 'xxxx', 'ok', 'Zephyr')`
  await sql`insert into sessions (id, user_id, expires_at)
            values (${createHash('sha256').update(token).digest('hex')}, ${userId}, now() + interval '2 hours')`
  await sql`
    insert into conversations (id, user_id, workspace_id, language, topic_id, topic_label, category, level, status)
    values (${conversationId}, ${userId}, ${workspaceId}, 'en', 'hobbies', 'Hobbies', 'daily-life', 'intermediate', 'active')`
}

const cookie = `fluentia_session=${token}`

async function main() {
  await new Promise((resolve) => mock.listen(mockPort, '127.0.0.1', resolve))
  await seed()

  /*
   * Proof of independence, not just of correctness: this account has no OpenAI
   * key at all, and the app is started with OPENAI_BASE_URL pointing at a dead
   * port. If anything in the Gemini path quietly reached for OpenAI, every
   * check below would fail.
   */
  const [row] = await sql`select openai_key_cipher from user_settings where user_id = ${userId}`
  record('this account has no OpenAI key whatsoever', row.openai_key_cipher === null)

  /* ------------------------------------------------- one full spoken turn */

  const form = new FormData()
  form.set('audio', new File([randomBytes(2048)], 'turn.webm', { type: 'audio/webm' }), 'turn.webm')
  form.set('audioMs', '4000')

  const turn = await fetch(`${base}/api/conversations/${conversationId}/turn`, {
    method: 'POST',
    headers: { cookie },
    body: form,
  })
  const turnBody = await turn.json().catch(() => ({}))
  record('a spoken turn completes on Gemini', turn.ok, `status ${turn.status} ${turnBody.error ?? ''}`)
  record(
    'the teacher replied, and the reply came back through Gemini',
    Boolean(turnBody.assistantMessage?.content),
    turnBody.assistantMessage?.content ?? JSON.stringify(turnBody).slice(0, 90),
  )
  record(
    'and the learner turn was transcribed from the audio',
    turnBody.userMessage?.content === 'I went out with my friends.',
    turnBody.userMessage?.content ?? '',
  )

  /* ------------------------------- the requests were shaped the Gemini way */

  const keyed = seen.every((call) => call.apiKey === FAKE_GEMINI_KEY)
  record('the key travels in the header, never in the URL', keyed && seen.every((c) => !c.url.includes('key=')))

  const transcription = seen.find((call) => JSON.stringify(call.body?.contents ?? '').includes('inlineData'))
  record('the audio is sent inline, with its mime type', Boolean(transcription))
  if (transcription) {
    const part = transcription.body.contents[0].parts.find((p) => p.inlineData)
    record('and it declares the recording format', part.inlineData.mimeType === 'audio/webm', part.inlineData.mimeType)
  }

  const schemaCall = seen.find((call) => call.body?.generationConfig?.responseSchema)
  record('the reply is constrained by a schema', Boolean(schemaCall))
  if (schemaCall) {
    const sent = JSON.stringify(schemaCall.body.generationConfig.responseSchema)
    record(
      'and the schema is in Gemini dialect, not JSON Schema',
      !sent.includes('additionalProperties'),
      'additionalProperties would be rejected by Google',
    )
    record(
      'the response mime asks for JSON',
      schemaCall.body.generationConfig.responseMimeType === 'application/json',
    )
    record(
      'the assistant role is renamed to the one Gemini uses',
      !JSON.stringify(schemaCall.body.contents).includes('"role":"assistant"'),
    )
  }

  /* ---------------------------------------------------- speech comes back */

  const speech = await fetch(`${base}/api/speech/word?word=hello`, { headers: { cookie } })
  record('speech is produced', speech.ok, `status ${speech.status}`)
  record(
    'and is labelled as the format Gemini actually returns',
    speech.headers.get('content-type') === 'audio/wav',
    speech.headers.get('content-type') ?? '',
  )

  const audio = Buffer.from(await speech.arrayBuffer())
  record(
    'the raw samples arrive wrapped as a playable file',
    audio.subarray(0, 4).toString() === 'RIFF' && audio.subarray(8, 12).toString() === 'WAVE',
    `${audio.length} bytes, starts with ${audio.subarray(0, 4).toString()}`,
  )

  const ttsCall = seen.find((c) => c.body?.generationConfig?.responseModalities)
  record(
    'the voice asked for is the one saved',
    ttsCall?.body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName === 'Zephyr',
  )

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
  process.exitCode = failures === 0 ? 0 : 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    mock.close()
    await sql`delete from users where email like '%@fluentia.test'`
    await sql.end()
  })
