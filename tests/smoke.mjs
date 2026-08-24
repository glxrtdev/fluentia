#!/usr/bin/env node
/**
 * End-to-end smoke test against a running server.
 *   node --env-file-if-exists=.env.local tests/smoke.mjs http://localhost:3000
 *
 * Checks the public pages, the auth guards, the real signup journey, every
 * authenticated page and the isolation rules on the conversation API. Fixtures
 * are seeded straight into Postgres and signed in with a real session token, so
 * the server code under test is exactly the code that runs in production.
 * OpenAI is never called.
 */
import { createHash, randomBytes, randomUUID, scryptSync } from 'node:crypto'

import postgres from 'postgres'

const base = process.argv[2] ?? 'http://localhost:3000'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Run with --env-file-if-exists=.env.local')
  process.exit(1)
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false })

let failures = 0
const record = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

const stamp = Date.now()
const password = `scrypt$${randomBytes(16).toString('hex')}$${scryptSync('x', 'y', 64).toString('hex')}`

/* ---------------------------------------------------------------- fixtures */

async function makeUser(label) {
  const id = randomUUID()

  await sql`
    insert into users (id, email, name, password_hash)
    values (${id}, ${`${label}-${stamp}@fluentia.test`}, ${`${label} Tester`}, ${password})
  `
  await sql`
    insert into profiles (user_id, level, onboarded_at, main_goal)
    values (${id}, 'intermediate', now(), 'career')
  `
  await sql`insert into user_settings (user_id) values (${id})`

  for (const [kind, target] of [
    ['weekly_sessions', 5],
    ['weekly_minutes', 100],
    ['weekly_words', 20],
    ['weekly_mistakes', 10],
  ]) {
    await sql`
      insert into goals (id, user_id, kind, target)
      values (${randomUUID()}, ${id}, ${kind}, ${target})
    `
  }

  const token = randomBytes(32).toString('base64url')
  await sql`
    insert into sessions (id, user_id, expires_at)
    values (${createHash('sha256').update(token).digest('hex')}, ${id}, now() + interval '1 day')
  `

  return { id, cookie: `fluentia_session=${token}` }
}

/** Throwaway fixtures are removed so the database stays clean. */
const cleanup = () => sql`delete from users where email like '%@fluentia.test'`

/* -------------------------------------------------------------------- http */

const call = (path, init = {}, cookie) =>
  fetch(`${base}${path}`, {
    redirect: 'manual',
    ...init,
    headers: { ...(init.headers ?? {}), ...(cookie ? { cookie } : {}) },
  })

const decodeEntities = (value) =>
  value
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')

/** Replays a form's hidden fields, including the valueless action reference. */
function hiddenFields(html) {
  const fields = []
  const pattern = /<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?/g
  let match
  while ((match = pattern.exec(html))) {
    fields.push([decodeEntities(match[1]), decodeEntities(match[2] ?? '')])
  }
  return fields
}

async function signupJourney() {
  let journeyCookie = ''
  const track = (response) => {
    for (const entry of response.headers.getSetCookie?.() ?? []) {
      const [pair] = entry.split(';')
      if (pair.startsWith('fluentia_session=')) journeyCookie = pair
    }
    return response
  }

  const page = track(await call('/signup'))
  const html = await page.text()

  const form = new FormData()
  for (const [name, value] of hiddenFields(html)) form.set(name, value)
  form.set('name', 'Journey Tester')
  form.set('email', `journey-${stamp}@fluentia.test`)
  form.set('password', 'sup3r-secret-pass')

  const signup = track(await call('/signup', { method: 'POST', body: form }))
  record(
    'signup creates an account and lands on onboarding',
    signup.status === 303 && signup.headers.get('location') === '/onboarding',
    `status ${signup.status} → ${signup.headers.get('location')}`,
  )
  record('signup issues a session cookie', journeyCookie.length > 0)

  const onboarding = await call('/onboarding', {}, journeyCookie)
  record('onboarding renders for the new account', onboarding.status === 200)
  const onboardingHtml = await onboarding.text()

  const wizard = new FormData()
  for (const [name, value] of hiddenFields(onboardingHtml)) wizard.set(name, value)

  const finished = await call('/onboarding', { method: 'POST', body: wizard }, journeyCookie)
  record(
    'onboarding completes and lands on the dashboard',
    finished.status === 303 && finished.headers.get('location') === '/dashboard',
    `status ${finished.status} → ${finished.headers.get('location')}`,
  )

  const dashboard = await call('/dashboard', {}, journeyCookie)
  const body = await dashboard.text()
  record('the new dashboard renders', dashboard.status === 200)
  record('a fresh account is told to add its OpenAI key', body.includes('One step left'))
  record('a fresh account starts with no practice', body.includes('Streak'))

  // Signing up twice with the same email must be refused.
  const duplicatePage = await call('/signup')
  const duplicateForm = new FormData()
  for (const [name, value] of hiddenFields(await duplicatePage.text())) {
    duplicateForm.set(name, value)
  }
  duplicateForm.set('name', 'Journey Tester')
  duplicateForm.set('email', `journey-${stamp}@fluentia.test`)
  duplicateForm.set('password', 'another-password')

  const duplicate = await call('/signup', { method: 'POST', body: duplicateForm })
  const duplicateBody = await duplicate.text()
  record(
    'a duplicate email is refused',
    duplicate.status === 200 && duplicateBody.includes('already registered'),
    `status ${duplicate.status}`,
  )
}

async function main() {
  const owner = await makeUser('owner')
  const intruder = await makeUser('intruder')

  // A conversation belonging to `owner`, used for the isolation checks.
  const conversationId = randomUUID()
  await sql`
    insert into conversations (id, user_id, topic_id, topic_label, category, level, status, duration_seconds, user_turns)
    values (${conversationId}, ${owner.id}, 'my-career', 'My career', 'career', 'intermediate', 'active', 0, 1)
  `

  const messageId = randomUUID()
  await sql`
    insert into conversation_messages (id, conversation_id, user_id, seq, role, content)
    values (${messageId}, ${conversationId}, ${owner.id}, 0, 'assistant', 'Tell me about your current job.')
  `

  await sql`
    insert into mistakes (id, user_id, category, signature, original, corrected, explanation, occurrences)
    values (${randomUUID()}, ${owner.id}, 'prepositions', 'prepositions:depend of>depend on',
            'depend of', 'depend on', 'In English we depend ON something.', 4)
  `

  await sql`
    insert into vocabulary (id, user_id, word, definition, status)
    values (${randomUUID()}, ${owner.id}, 'entrepreneurship', 'The activity of setting up a business.', 'learning')
  `

  /* public surface */
  const landing = await call('/')
  record('landing renders', landing.status === 200)
  record('landing is branded', (await landing.text()).includes('Fluentia'))

  for (const path of ['/login', '/signup']) {
    record(`${path} renders`, (await call(path)).status === 200)
  }

  /* auth guards */
  const anonymous = await call('/dashboard')
  record(
    'dashboard redirects anonymous visitors to /login',
    anonymous.status === 307 && (anonymous.headers.get('location') ?? '').includes('/login'),
    `status ${anonymous.status}`,
  )
  record(
    'turn API is 401 for anonymous',
    (await call(`/api/conversations/${conversationId}/turn`, { method: 'POST' })).status === 401,
  )
  record(
    'speech API is 401 for anonymous',
    (await call(`/api/speech?messageId=${messageId}`)).status === 401,
  )

  /* authenticated pages */
  for (const path of [
    '/dashboard',
    '/speak',
    `/speak/${conversationId}`,
    '/sessions',
    '/mistakes',
    '/vocabulary',
    '/profile',
    '/goals',
    '/achievements',
    '/settings',
  ]) {
    const page = await call(path, {}, owner.cookie)
    record(`${path} renders when signed in`, page.status === 200, `status ${page.status}`)
  }

  const backToApp = await call('/login', {}, owner.cookie)
  record('signed-in users are pushed out of /login', backToApp.status === 307)

  /* per-user isolation — the rule that matters most */
  const foreignRoom = await call(`/speak/${conversationId}`, {}, intruder.cookie)
  record('another user cannot open the room', foreignRoom.status === 404, `status ${foreignRoom.status}`)

  const foreignTurn = await call(
    `/api/conversations/${conversationId}/turn`,
    { method: 'POST' },
    intruder.cookie,
  )
  record('another user cannot post a turn', foreignTurn.status === 404, `status ${foreignTurn.status}`)

  const foreignSpeech = await call(`/api/speech?messageId=${messageId}`, {}, intruder.cookie)
  record(
    'another user cannot fetch the audio',
    foreignSpeech.status === 404,
    `status ${foreignSpeech.status}`,
  )

  const foreignEnd = await call(
    `/api/conversations/${conversationId}/end`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ durationSeconds: 60 }),
    },
    intruder.cookie,
  )
  record('another user cannot end the session', foreignEnd.status === 404, `status ${foreignEnd.status}`)

  /* missing API key must fail honestly, not silently */
  const noKey = await call(
    `/api/conversations/${conversationId}/end`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ durationSeconds: 60 }),
    },
    owner.cookie,
  )
  const noKeyBody = await noKey.json().catch(() => ({}))
  record(
    'missing OpenAI key returns a clear error',
    noKey.status === 428 && /API key/i.test(noKeyBody.error ?? ''),
    `status ${noKey.status} — ${noKeyBody.error ?? ''}`,
  )

  await signupJourney()

  /* translation needs a key too, and says so */
  const translate = await call(
    '/api/translate',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ word: 'deadline', definition: 'A time limit.' }),
    },
    owner.cookie,
  )
  record('translation without a key returns 428', translate.status === 428, `status ${translate.status}`)
  record(
    'translation API is 401 for anonymous',
    (
      await call('/api/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ word: 'x', definition: 'y' }),
      })
    ).status === 401,
  )

  /* dictionary proxy */
  const dictionary = await call('/api/dictionary?word=entrepreneurship', {}, owner.cookie)
  const entry = await dictionary.json().catch(() => null)
  record(
    'dictionary returns a real definition',
    dictionary.status === 200 && Boolean(entry?.definitions?.length),
    `status ${dictionary.status}`,
  )
  record(
    'dictionary rejects junk input',
    (await call('/api/dictionary?word=%3Cscript%3E', {}, owner.cookie)).status === 400,
  )

  /* deleting a user must take their data with them */
  const before = await sql`select count(*)::int as n from conversations where user_id = ${owner.id}`
  await sql`delete from users where id = ${owner.id}`
  const after = await sql`select count(*)::int as n from conversations where user_id = ${owner.id}`
  record(
    'deleting a user cascades to their conversations',
    before[0].n === 1 && after[0].n === 0,
    `${before[0].n} → ${after[0].n}`,
  )

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`)
  process.exitCode = failures === 0 ? 0 : 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await cleanup()
    await sql.end()
  })
