#!/usr/bin/env node
/**
 * Exercises the whole voice loop against an OpenAI-compatible test double:
 *   audio in → transcript → teacher reply + corrections → speech out → report.
 *
 * Start the app with OPENAI_BASE_URL pointing at the mock this script prints,
 * then run it. Nothing here touches the real OpenAI API.
 *
 *   node tests/voice-loop.mjs http://localhost:3117 4319
 */
import { createServer } from 'node:http'
import { createCipheriv, createHash, randomBytes, scryptSync } from 'node:crypto'
import { resolve } from 'node:path'

import Database from 'better-sqlite3'

const base = process.argv[2] ?? 'http://localhost:3000'
const mockPort = Number(process.argv[3] ?? 4319)
const dbFile = resolve(process.cwd(), process.env.DATABASE_URL ?? './data/fluentia.db')

let failures = 0
const record = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

/* ----------------------------------------------------- OpenAI test double */

const TRANSCRIPT = 'Yesterday I go to the university and make a presentation about my job.'

const TURN = {
  reply: "That sounds like a big day. How did the presentation go?",
  corrections: [
    {
      category: 'grammar',
      original: 'I go',
      corrected: 'I went',
      explanation: 'Yesterday needs the past simple.',
      better_sentence: 'Yesterday I went to the university and made a presentation.',
      severity: 3,
    },
    {
      category: 'grammar',
      original: 'make a presentation',
      corrected: 'made a presentation',
      explanation: 'Keep the whole sentence in the past.',
      better_sentence: '',
      severity: 2,
    },
    {
      // Must be dropped: original and corrected are the same.
      category: 'naturalness',
      original: 'my job',
      corrected: 'my job',
      explanation: '',
      better_sentence: '',
      severity: 1,
    },
  ],
  level_signal: 'right',
}

const REPORT = {
  speaking: 78,
  grammar: 72,
  vocabulary: 84,
  fluency: 76,
  pronunciation: null,
  estimated_level: 'B2',
  summary: 'You kept the conversation going well. Watch your past tenses.',
  main_mistakes: [
    { label: 'Past tense', detail: 'You said "I go" when talking about yesterday.' },
    { label: 'Verb agreement', detail: '"make" should have been "made".' },
  ],
  new_words: [{ word: 'deadline', meaning: 'The time by which something must be finished.' }],
  expressions: [{ expression: 'meet a deadline', meaning: 'Finish something in time.' }],
  recommendations: ['Try a conversation about your last weekend to drill the past simple.'],
  strengths: ['Vocabulary', 'Listening'],
  weaknesses: ['Verb tenses', 'Prepositions'],
}

const calls = []

const mock = createServer((request, response) => {
  const chunks = []
  request.on('data', (chunk) => chunks.push(chunk))
  request.on('end', () => {
    const body = Buffer.concat(chunks)
    calls.push({ url: request.url, method: request.method, bytes: body.length })

    const json = (payload, status = 200) => {
      response.writeHead(status, { 'content-type': 'application/json' })
      response.end(JSON.stringify(payload))
    }

    if (request.url?.startsWith('/v1/models')) return json({ object: 'list', data: [] })

    if (request.url?.startsWith('/v1/audio/transcriptions')) {
      return json({ text: TRANSCRIPT })
    }

    if (request.url?.startsWith('/v1/audio/speech')) {
      // A tiny but valid-looking MP3 frame header is enough for the stream test.
      response.writeHead(200, { 'content-type': 'audio/mpeg' })
      return response.end(Buffer.from([0xff, 0xfb, 0x90, 0x00, ...new Array(64).fill(0)]))
    }

    if (request.url?.startsWith('/v1/chat/completions')) {
      const payload = JSON.parse(body.toString('utf8') || '{}')
      const schema = payload.response_format?.json_schema?.name
      // No schema means the plain-text translation call.
      const content = schema
        ? JSON.stringify(schema === 'session_report' ? REPORT : TURN)
        : 'prazo de entrega'

      return json({
        id: 'chatcmpl-mock',
        object: 'chat.completion',
        created: 0,
        model: payload.model,
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      })
    }

    json({ error: { message: `Unexpected mock call: ${request.url}` } }, 404)
  })
})

/* ---------------------------------------------------------------- fixtures */

const db = new Database(dbFile)
db.pragma('foreign_keys = ON')

/** Same AES-256-GCM envelope the app writes, reimplemented so the test is independent. */
function encryptSecret(plaintext) {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new Error('ENCRYPTION_KEY missing — run with --env-file-if-exists=.env.local')
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : createHash('sha256').update(raw).digest()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString('base64')).join('.')
}

const userId = crypto.randomUUID()
const token = randomBytes(32).toString('base64url')
const cookie = `fluentia_session=${token}`
const conversationId = crypto.randomUUID()

db.prepare('insert into users (id, email, name, password_hash) values (?, ?, ?, ?)').run(
  userId,
  `voice-${Date.now()}@fluentia.test`,
  'Voice Tester',
  `scrypt$${randomBytes(16).toString('hex')}$${scryptSync('x', 'y', 64).toString('hex')}`,
)
db.prepare(
  'insert into profiles (user_id, level, onboarded_at, auto_adapt_level, main_goal) values (?, ?, ?, ?, ?)',
).run(userId, 'intermediate', Date.now(), 1, 'career')
db.prepare(
  'insert into user_settings (user_id, openai_key_cipher, openai_key_hint, openai_key_status) values (?, ?, ?, ?)',
).run(userId, encryptSecret('sk-test-key-not-real'), 'real', 'ok')
db.prepare('insert into sessions (id, user_id, expires_at) values (?, ?, ?)').run(
  createHash('sha256').update(token).digest('hex'),
  userId,
  Date.now() + 86_400_000,
)
db.prepare(
  'insert into conversations (id, user_id, topic_id, topic_label, category, level, status) values (?, ?, ?, ?, ?, ?, ?)',
).run(conversationId, userId, 'my-career', 'My career', 'career', 'intermediate', 'active')
db.prepare(
  'insert into conversation_messages (id, conversation_id, user_id, seq, role, content) values (?, ?, ?, ?, ?, ?)',
).run(crypto.randomUUID(), conversationId, userId, 0, 'assistant', 'Tell me about your current job.')


/** Throwaway fixtures are removed so the development database stays clean. */
function cleanup() {
  db.prepare("delete from users where email like '%@fluentia.test'").run()
}

/* -------------------------------------------------------------------- run */

const call = (path, init = {}) =>
  fetch(`${base}${path}`, { redirect: 'manual', ...init, headers: { cookie, ...(init.headers ?? {}) } })

async function main() {
  await new Promise((done) => mock.listen(mockPort, '127.0.0.1', done))
  console.log(`mock OpenAI listening on http://127.0.0.1:${mockPort}/v1\n`)

  /* --- one full turn ------------------------------------------------------ */
  const form = new FormData()
  form.set('audio', new File([randomBytes(4096)], 'turn.webm', { type: 'audio/webm' }), 'turn.webm')
  form.set('audioMs', '4200')

  const turn = await call(`/api/conversations/${conversationId}/turn`, { method: 'POST', body: form })
  const data = await turn.json()

  record('turn accepted', turn.status === 200, `status ${turn.status} ${data.error ?? ''}`)
  record('audio was transcribed', data.userMessage?.content === TRANSCRIPT)
  record('teacher replied', data.assistantMessage?.content === TURN.reply)
  record(
    'the spoken reply carries no correction text',
    !/went|made|past tense|correct/i.test(data.assistantMessage?.content ?? ''),
  )
  record(
    'identical original/corrected pairs are dropped',
    data.corrections?.length === 2,
    `${data.corrections?.length} kept of 3 returned`,
  )
  record(
    'corrections carry the better sentence',
    data.corrections?.some((c) => (c.betterSentence ?? '').startsWith('Yesterday I went')),
  )

  const messages = db
    .prepare('select role, content, seq from conversation_messages where conversation_id = ? order by seq')
    .all(conversationId)
  record('both turns were persisted in order', messages.length === 3 && messages[1].role === 'user')

  const storedCorrections = db
    .prepare('select * from corrections where conversation_id = ?')
    .all(conversationId)
  record('corrections were stored', storedCorrections.length === 2)
  record(
    'corrections are scoped to the owner',
    storedCorrections.every((row) => row.user_id === userId),
  )

  const mistakes = db
    .prepare('select * from mistakes where user_id = ? order by occurrences desc')
    .all(userId)
  record('mistakes ledger was updated live', mistakes.length === 2)

  /* --- the same mistake again should increment, not duplicate -------------
   * Four turns in total: the report only adapts the level when the session
   * carries enough evidence (>= 4 learner turns).
   */
  for (let extra = 0; extra < 3; extra += 1) {
    const body = new FormData()
    body.set('audio', new File([randomBytes(4096)], 'turn.webm', { type: 'audio/webm' }), 'turn.webm')
    const next = await call(`/api/conversations/${conversationId}/turn`, { method: 'POST', body })
    record(`turn ${extra + 2} accepted`, next.status === 200)
  }

  const repeated = db
    .prepare('select occurrences from mistakes where user_id = ? order by occurrences desc')
    .all(userId)
  record(
    'a repeated mistake increments its counter instead of duplicating',
    repeated.length === 2 && repeated[0].occurrences === 4,
    `counts: ${repeated.map((m) => m.occurrences).join(',')}`,
  )

  const occurrences = db
    .prepare('select count(*) as n from mistake_occurrences where user_id = ?')
    .get(userId)
  record('each occurrence is logged separately', occurrences.n === 8, `${occurrences.n} rows`)

  /* --- speech ------------------------------------------------------------- */
  const speech = await call(`/api/speech?messageId=${data.assistantMessage.id}`)
  const audio = Buffer.from(await speech.arrayBuffer())
  record(
    'teacher audio streams back as mp3',
    speech.status === 200 && speech.headers.get('content-type') === 'audio/mpeg' && audio.length > 0,
    `${audio.length} bytes`,
  )
  record(
    'audio responses are never publicly cacheable',
    (speech.headers.get('cache-control') ?? '').includes('private'),
  )

  const learnerMessage = db
    .prepare("select id from conversation_messages where conversation_id = ? and role = 'user' limit 1")
    .get(conversationId)
  const badSpeech = await call(`/api/speech?messageId=${learnerMessage.id}`)
  record('the learner’s own turn cannot be synthesised', badSpeech.status === 400)

  /* --- end of session ----------------------------------------------------- */
  const end = await call(`/api/conversations/${conversationId}/end`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ durationSeconds: 420, tzOffset: 180 }),
  })
  const endData = await end.json()
  record('session ended', end.status === 200, `status ${end.status} ${endData.error ?? ''}`)

  const report = db.prepare('select * from session_reports where conversation_id = ?').get(conversationId)
  record('report was stored', Boolean(report))
  record('scores came through', report?.speaking === 78 && report?.fluency === 76)
  record('pronunciation stays null without evidence', report?.pronunciation === null)
  record('main mistakes were kept', JSON.parse(report?.main_mistakes ?? '[]').length === 2)
  record('expressions were kept', JSON.parse(report?.expressions ?? '[]').length === 1)

  const conversation = db.prepare('select * from conversations where id = ?').get(conversationId)
  record(
    'conversation is closed with its duration',
    conversation.status === 'completed' && conversation.duration_seconds === 420,
  )

  const profile = db.prepare('select * from profiles where user_id = ?').get(userId)
  record('CEFR estimate reached the profile', profile.estimated_cefr === 'B2')
  record(
    'auto-adapt nudged the level one step',
    profile.level === 'upper-intermediate',
    `level is ${profile.level}`,
  )
  record('strengths were recorded', JSON.parse(profile.strengths).includes('Vocabulary'))
  record('practice time accumulated', profile.total_practice_seconds === 420)
  record('sessions completed counted', profile.sessions_completed === 1)
  record('streak started', profile.streak_current === 1 && profile.last_practice_date !== null)
  record('XP was awarded', profile.xp > 0, `${profile.xp} XP`)

  const unlocked = db
    .prepare('select achievement_id from user_achievements where user_id = ?')
    .all(userId)
    .map((row) => row.achievement_id)
  record('first conversation achievement unlocked', unlocked.includes('first-conversation'))
  record('career achievement unlocked from the topic', unlocked.includes('first-career-session'))

  /* --- a closed session refuses more turns -------------------------------- */
  const form3 = new FormData()
  form3.set('audio', new File([randomBytes(1024)], 'turn.webm', { type: 'audio/webm' }), 'turn.webm')
  const afterEnd = await call(`/api/conversations/${conversationId}/turn`, {
    method: 'POST',
    body: form3,
  })
  record('a finished session rejects new turns', afterEnd.status === 409)

  const secondEnd = await call(`/api/conversations/${conversationId}/end`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ durationSeconds: 420 }),
  })
  const secondEndData = await secondEnd.json()
  record(
    'ending twice reuses the existing report',
    secondEnd.status === 200 && secondEndData.reportId === report.id,
  )

  /* --- translation, on demand only ---------------------------------------- */
  const word = db
    .prepare('select id from vocabulary where user_id = ? limit 1')
    .get(userId)
  db.prepare(
    'insert into vocabulary (id, user_id, word, definition) values (?, ?, ?, ?)',
  ).run(word ? crypto.randomUUID() : crypto.randomUUID(), userId, 'deadline', 'A time limit.')
  const saved = db
    .prepare("select id, translation from vocabulary where user_id = ? and word = 'deadline'")
    .get(userId)
  record('a saved word starts untranslated', saved.translation === null)

  const translated = await call('/api/translate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ word: 'deadline', definition: 'A time limit.', vocabularyId: saved.id }),
  })
  const translationBody = await translated.json()
  record(
    'translation returns the learner language',
    translated.status === 200 && translationBody.translation === 'prazo de entrega',
    `status ${translated.status} — ${translationBody.translation ?? translationBody.error}`,
  )
  record(
    'translation is persisted on the saved word',
    db.prepare('select translation from vocabulary where id = ?').get(saved.id).translation ===
      'prazo de entrega',
  )

  /* --- input guards ------------------------------------------------------- */
  const emptyBody = new FormData()
  emptyBody.set('audio', new File([], 'turn.webm', { type: 'audio/webm' }), 'turn.webm')
  const fresh = crypto.randomUUID()
  db.prepare(
    'insert into conversations (id, user_id, topic_id, topic_label, category, level, status) values (?, ?, ?, ?, ?, ?, ?)',
  ).run(fresh, userId, 'hobbies', 'Hobbies', 'daily-life', 'intermediate', 'active')

  const emptyUpload = await call(`/api/conversations/${fresh}/turn`, {
    method: 'POST',
    body: emptyBody,
  })
  record('empty recordings are rejected', emptyUpload.status === 400)

  const wrongType = new FormData()
  wrongType.set('audio', new File([randomBytes(64)], 'x.txt', { type: 'text/plain' }), 'x.txt')
  const badType = await call(`/api/conversations/${fresh}/turn`, { method: 'POST', body: wrongType })
  record('non-audio uploads are rejected', badType.status === 415)

  console.log(`\nmock received ${calls.length} OpenAI calls: ${calls.map((c) => c.url).join(', ')}`)
  console.log(`${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`)
  process.exitCode = failures === 0 ? 0 : 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    cleanup()
    db.close()
    mock.close()
  })
