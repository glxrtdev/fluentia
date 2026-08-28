/**
 * Both keys saved at once — only the selected provider is ever contacted.
 *
 * This is the case the other tests do not cover. `gemini-wire.mjs` proves
 * Gemini needs no OpenAI by giving the account no OpenAI key at all; that is a
 * strong proof, but it is not the situation a real learner ends up in. Once
 * both keys are stored, "which one runs" stops being decided by which key
 * exists and starts being decided by a single column — and a stray import, a
 * cached client or a leftover model override could quietly contact the other.
 *
 * So both providers are stood up as separate doubles, both keys are saved, and
 * every request each double receives is counted. The pass condition is not
 * "the right one answered" — it is that the other one heard **nothing**.
 *
 * Run against a server pointed at both doubles:
 *   OPENAI_BASE_URL=http://127.0.0.1:4330/v1 GEMINI_BASE_URL=http://127.0.0.1:4331 next start
 */
import { createServer } from 'node:http'
import { createCipheriv, createHash, randomBytes, randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { chromium } from 'playwright'
import { FAKE_GEMINI_AUTH_KEY, FAKE_OPENAI_KEY } from './fake-keys.mjs'

const base = process.argv[2] ?? 'http://localhost:3100'
const openaiPort = Number(process.argv[3] ?? 4330)
const geminiPort = Number(process.argv[4] ?? 4331)

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} })

let failures = 0
const record = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

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

/* ---------------------------------------------------------------- doubles */

/** Everything each provider was asked for, so silence can be asserted. */
const hits = { openai: [], gemini: [] }

const readBody = (request) =>
  new Promise((resolve) => {
    const chunks = []
    request.on('data', (c) => chunks.push(c))
    request.on('end', () => resolve(Buffer.concat(chunks)))
  })

const openaiMock = createServer(async (request, response) => {
  await readBody(request)
  hits.openai.push({
    url: request.url,
    auth: request.headers.authorization,
    what: request.url.includes('/audio/transcriptions')
      ? 'hear'
      : request.url.includes('/audio/speech')
        ? 'speak'
        : request.url.includes('/models')
          ? 'list models'
          : 'think',
  })

  const json = (payload) => {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify(payload))
  }

  if (request.url.includes('/audio/transcriptions')) {
    return json({ text: 'I went out with my friends.' })
  }
  if (request.url.includes('/audio/speech')) {
    response.writeHead(200, { 'content-type': 'audio/mpeg' })
    return response.end(Buffer.alloc(512))
  }
  if (request.url.includes('/models')) return json({ data: [{ id: 'gpt-4o' }] })

  const turn = {
    reply: 'That sounds good. What did you do next?',
    corrections: [],
    level_signal: 'right',
  }
  return json({
    id: 'chatcmpl-x',
    choices: [{ message: { content: JSON.stringify(turn) }, finish_reason: 'stop' }],
    usage: { total_tokens: 10 },
  })
})

const geminiMock = createServer(async (request, response) => {
  const raw = await readBody(request)
  const body = raw.length ? JSON.parse(raw.toString('utf8')) : null
  hits.gemini.push({
    url: request.url,
    key: request.headers['x-goog-api-key'],
    voice: body?.generationConfig?.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName,
    what: request.url.startsWith('/models?')
      ? 'list models'
      : body?.generationConfig?.responseModalities?.includes('AUDIO')
        ? 'speak'
        : JSON.stringify(body?.contents ?? '').includes('inlineData')
          ? 'hear'
          : 'think',
  })

  const json = (payload) => {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify(payload))
  }

  if (request.url.startsWith('/models?')) {
    return json({ models: [{ name: 'models/gemini-2.5-flash' }] })
  }

  if (body?.generationConfig?.responseModalities?.includes('AUDIO')) {
    return json({
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  mimeType: 'audio/L16;codec=pcm;rate=24000',
                  data: Buffer.alloc(480).toString('base64'),
                },
              },
            ],
          },
        },
      ],
    })
  }

  if (JSON.stringify(body?.contents ?? '').includes('inlineData')) {
    return json({ candidates: [{ content: { parts: [{ text: 'I went out with my friends.' }] } }] })
  }

  const turn = {
    reply: 'That sounds good. What did you do next?',
    corrections: [],
    level_signal: 'right',
  }
  return json({ candidates: [{ content: { parts: [{ text: JSON.stringify(turn) }] } }] })
})

/* ------------------------------------------------------------------- seed */

const userId = randomUUID()
const workspaceId = randomUUID()
const token = randomBytes(32).toString('base64url')
const cookie = `fluentia_session=${token}`

const OPENAI_KEY = FAKE_OPENAI_KEY
const GEMINI_KEY = FAKE_GEMINI_AUTH_KEY

async function seed() {
  await sql`insert into users (id, email, name, password_hash)
            values (${userId}, ${`both-${Date.now()}@fluentia.test`}, 'Enzo', 'x')`
  await sql`insert into profiles (user_id, onboarded_at) values (${userId}, now())`
  await sql`insert into workspaces (id, user_id, language, level)
            values (${workspaceId}, ${userId}, 'en', 'intermediate')`

  /*
   * Both keys, both marked healthy — exactly the state a learner reaches after
   * trying one provider and then the other. `voice` is deliberately an OpenAI
   * voice, so a switch to Gemini that forgot to clear it would send "alloy" to
   * Google, and that would surface here rather than as a puzzling 400 later.
   */
  await sql`
    insert into user_settings (user_id, active_workspace_id, ai_provider,
                               openai_key_cipher, openai_key_hint, openai_key_status,
                               gemini_key_cipher, gemini_key_hint, gemini_key_status, voice)
    values (${userId}, ${workspaceId}, 'openai',
            ${encryptSecret(OPENAI_KEY)}, 'xxxx', 'ok',
            ${encryptSecret(GEMINI_KEY)}, 'xxxx', 'ok', 'alloy')`

  await sql`insert into sessions (id, user_id, expires_at)
            values (${createHash('sha256').update(token).digest('hex')}, ${userId},
                    now() + interval '2 hours')`
}

async function conversation() {
  const id = randomUUID()
  await sql`
    insert into conversations (id, user_id, workspace_id, language, topic_id, topic_label,
                               category, level, status)
    values (${id}, ${userId}, ${workspaceId}, 'en', 'hobbies', 'Hobbies', 'daily-life',
            'intermediate', 'active')`
  return id
}

/** Hear, think and speak in one go — all three capabilities in one exercise. */
async function exercise(conversationId) {
  const form = new FormData()
  form.set('audio', new File([randomBytes(2048)], 'turn.webm', { type: 'audio/webm' }), 'turn.webm')
  form.set('audioMs', '4000')

  const started = Date.now()
  const turn = await fetch(`${base}/api/conversations/${conversationId}/turn`, {
    method: 'POST',
    headers: { cookie },
    body: form,
  })
  const turnBody = await turn.json().catch(() => ({}))

  const speech = await fetch(`${base}/api/speech/word?word=hello`, { headers: { cookie } })
  const audio = Buffer.from(await speech.arrayBuffer())

  return {
    ok: turn.ok && speech.ok,
    status: `${turn.status}/${speech.status}`,
    error: turnBody.error,
    heard: turnBody.userMessage?.content,
    thought: turnBody.assistantMessage?.content,
    spokeBytes: audio.length,
    contentType: speech.headers.get('content-type'),
    ms: Date.now() - started,
  }
}

async function main() {
  await new Promise((r) => openaiMock.listen(openaiPort, '127.0.0.1', r))
  await new Promise((r) => geminiMock.listen(geminiPort, '127.0.0.1', r))
  await seed()

  const [saved] = await sql`
    select openai_key_cipher is not null as has_openai,
           gemini_key_cipher is not null as has_gemini
    from user_settings where user_id = ${userId}`
  record(
    'the account really does hold both keys at once',
    saved.has_openai && saved.has_gemini,
    `openai ${saved.has_openai}, gemini ${saved.has_gemini}`,
  )

  /* ------------------------------------------------------ selected: OpenAI */

  hits.openai = []
  hits.gemini = []
  const onOpenAi = await exercise(await conversation())

  record(
    'with OpenAI selected, a full turn works',
    onOpenAi.ok,
    `${onOpenAi.status} ${onOpenAi.error ?? ''}`,
  )
  record('  it heard', onOpenAi.heard === 'I went out with my friends.', onOpenAi.heard ?? '')
  record('  it thought', Boolean(onOpenAi.thought), onOpenAi.thought ?? '')
  record('  it spoke', onOpenAi.spokeBytes > 0, `${onOpenAi.spokeBytes} bytes, ${onOpenAi.contentType}`)
  record('OpenAI was the one contacted', hits.openai.length > 0, `${hits.openai.length} requests`)
  record(
    'and Gemini heard nothing at all',
    hits.gemini.length === 0,
    `${hits.gemini.length} requests${hits.gemini.length ? `: ${hits.gemini.map((h) => h.url).join(', ')}` : ''}`,
  )
  record(
    'the key sent was the OpenAI one, not the other',
    hits.openai.length > 0 && hits.openai.every((h) => h.auth === `Bearer ${OPENAI_KEY}`),
    hits.openai[0]?.auth?.slice(0, 24) ?? 'none',
  )
  const openaiCalls = hits.openai.length
  const openaiHits = [...hits.openai]

  /* -------------------------------------- switch to Gemini, in the browser */

  const browser = await chromium.launch()
  const context = await browser.newContext()
  await context.addCookies([
    { name: 'fluentia_session', value: token, domain: 'localhost', path: '/' },
  ])
  const page = await context.newPage()
  await page.goto(`${base}/settings`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Google Gemini/ }).click()
  /*
   * The button marks itself pressed the instant it is clicked — optimistic
   * state, not the server's answer. Waiting on it reads the row before the
   * action has written it, so the switch is polled where it is actually
   * recorded.
   */
  let after
  for (let attempt = 0; attempt < 60; attempt += 1) {
    ;[after] = await sql`
      select ai_provider, voice, chat_model from user_settings where user_id = ${userId}`
    if (after.ai_provider === 'gemini') break
    await new Promise((r) => setTimeout(r, 250))
  }
  await browser.close()
  record('the switch is recorded', after.ai_provider === 'gemini', after.ai_provider)
  record(
    "and it did not carry OpenAI's voice across",
    after.voice !== 'alloy',
    `voice = ${after.voice ?? 'null'}`,
  )

  /* ------------------------------------------------------ selected: Gemini */

  hits.openai = []
  hits.gemini = []
  const onGemini = await exercise(await conversation())

  record(
    'with Gemini selected, a full turn works',
    onGemini.ok,
    `${onGemini.status} ${onGemini.error ?? ''}`,
  )
  record('  it heard', onGemini.heard === 'I went out with my friends.', onGemini.heard ?? '')
  record('  it thought', Boolean(onGemini.thought), onGemini.thought ?? '')
  record('  it spoke', onGemini.spokeBytes > 0, `${onGemini.spokeBytes} bytes, ${onGemini.contentType}`)
  record('Gemini was the one contacted', hits.gemini.length > 0, `${hits.gemini.length} requests`)
  record(
    'and OpenAI heard nothing at all',
    hits.openai.length === 0,
    `${hits.openai.length} requests${hits.openai.length ? `: ${hits.openai.map((h) => h.url).join(', ')}` : ''}`,
  )
  record(
    'the key sent was the new AQ. one, not the OpenAI key',
    hits.gemini.length > 0 && hits.gemini.every((h) => h.key === GEMINI_KEY),
    hits.gemini[0]?.key?.slice(0, 12) ?? 'none',
  )

  /* --------------------------------------------------------- the work done */

  /*
   * Not a speed benchmark — the doubles answer instantly, so wall-clock here
   * says nothing about how fast Google or OpenAI are. What it does show is
   * whether the app itself does more work on one path than the other: a
   * provider needing two calls where the other needs one would cost double
   * per turn, and that would be the app's fault rather than the provider's.
   */
  /*
   * Only the conversation is compared. Listing the model catalogue is a
   * settings-page cost, cached for half an hour per user and provider, and it
   * lands here at all only because revalidating that page after the switch
   * happens to overlap this window — it is not paid per turn by either side.
   */
  const spoken = (calls) => calls.filter((h) => h.what !== 'list models').map((h) => h.what)
  const openaiTurn = spoken(hits.openai.length ? hits.openai : openaiHits)
  const geminiTurn = spoken(hits.gemini)

  record(
    'a turn costs the same number of round trips on either provider',
    geminiTurn.length === openaiTurn.length,
    `OpenAI ${openaiTurn.length} (${openaiTurn.join(' + ')}), ` +
      `Gemini ${geminiTurn.length} (${geminiTurn.join(' + ')})`,
  )
  record(
    'and it is the same three jobs, in the same order',
    geminiTurn.join(',') === openaiTurn.join(','),
    `${openaiTurn.join(' + ')} vs ${geminiTurn.join(' + ')}`,
  )
  record(
    'the voice sent to Gemini is one of its own',
    hits.gemini.filter((h) => h.voice).every((h) => h.voice !== 'alloy'),
    hits.gemini.find((h) => h.voice)?.voice ?? 'none sent',
  )
  console.log(
    `\n      (mesmo trabalho dos dois lados: ${openaiCalls} chamadas por rodada. ` +
      `Tempo contra os dublês — OpenAI ${onOpenAi.ms}ms, Gemini ${onGemini.ms}ms — ` +
      'mede o app, não os provedores.)',
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
    openaiMock.close()
    geminiMock.close()
    await sql`delete from users where email like '%@fluentia.test'`
    await sql.end()
  })
