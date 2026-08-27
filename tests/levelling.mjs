/**
 * Levelling, against the real database and the real report pipeline.
 *
 * The pure rules are covered in `progression.test.mjs`. What this proves is
 * the part unit tests cannot: that the promotion is a real change to stored
 * state, made at the moment the session closes, and visible on the very report
 * that earned it — not something the Progress tab works out later.
 *
 * Run against a server wired to the mock OpenAI this file starts, whose
 * speaking score it sets before each session.
 */
import { createServer } from 'node:http'
import { createCipheriv, createHash, randomBytes, randomUUID } from 'node:crypto'
import postgres from 'postgres'

/*
 * Mirrors `lib/crypto`, which is server-only and cannot be imported here. The
 * key handling has to match exactly, or the app cannot read the key back.
 */
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

const base = process.argv[2] ?? 'http://localhost:3100'
const mockPort = Number(process.argv[3] ?? 4319)

/*
 * The score is the input to every rule under test, so the double is driven
 * from here rather than the app being taught a test-only query parameter.
 */
let currentScore = 60

const mock = createServer((request, response) => {
  const chunks = []
  request.on('data', (chunk) => chunks.push(chunk))
  request.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8') || '{}'
    const json = (payload) => {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify(payload))
    }

    if (request.url?.startsWith('/v1/chat/completions')) {
      const report = {
        speaking: currentScore,
        grammar: currentScore,
        vocabulary: currentScore,
        fluency: currentScore,
        pronunciation: null,
        summary: 'Uma conversa de teste.',
        main_mistakes: [],
        new_words: [],
        expressions: [],
        recommendations: [],
        strengths: [],
        weaknesses: [],
      }
      return json({
        id: 'chatcmpl-mock',
        choices: [{ message: { content: JSON.stringify(report) }, finish_reason: 'stop' }],
      })
    }

    response.writeHead(404, { 'content-type': 'application/json' })
    response.end('{}')
  })
})
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} })

let failures = 0
const record = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

const EMAIL = `lvl-${Date.now()}@fluentia.test`
const userId = randomUUID()
const workspaceId = randomUUID()
const token = randomBytes(32).toString('base64url')

async function seed() {
  await sql`insert into users (id, email, name, password_hash) values (${userId}, ${EMAIL}, 'Enzo', 'x')`
  await sql`insert into profiles (user_id, onboarded_at) values (${userId}, now())`
  await sql`
    insert into workspaces (id, user_id, language, level, official_cefr, level_progress, consistency_streak)
    values (${workspaceId}, ${userId}, 'en', 'intermediate', 'B1', 100, 0)`
  await sql`
    insert into user_settings (user_id, active_workspace_id, openai_key_cipher, openai_key_hint, openai_key_status)
    values (${userId}, ${workspaceId}, ${encryptSecret('sk-test-key-not-real')}, 'real', 'ok')`
  await sql`
    insert into sessions (id, user_id, expires_at)
    values (${createHash('sha256').update(token).digest('hex')}, ${userId}, now() + interval '2 hours')`
}

/**
 * One finished session at a chosen score, through the real end-of-session
 * route. Five user turns, so it clears the evidence bar.
 */
async function runSession(score, durationSeconds = 420) {
  const conversationId = randomUUID()
  await sql`
    insert into conversations (id, user_id, workspace_id, language, topic_id, topic_label, category, level, status)
    values (${conversationId}, ${userId}, ${workspaceId}, 'en', 'hobbies', 'Hobbies', 'daily-life', 'intermediate', 'active')`

  for (let seq = 0; seq < 10; seq += 1) {
    await sql`
      insert into conversation_messages (id, conversation_id, user_id, seq, role, content)
      values (${randomUUID()}, ${conversationId}, ${userId}, ${seq},
              ${seq % 2 === 0 ? 'assistant' : 'user'},
              ${seq % 2 === 0 ? 'And then what happened?' : 'I went out with my friends and we talked for hours.'})`
  }

  currentScore = score
  const response = await fetch(`${base}/api/conversations/${conversationId}/end`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `fluentia_session=${token}` },
    body: JSON.stringify({ durationSeconds, day: '2026-08-27', tzOffsetMinutes: 180 }),
  })
  if (!response.ok) throw new Error(`end returned ${response.status}: ${await response.text()}`)

  const [workspace] = await sql`select * from workspaces where id = ${workspaceId}`
  const [report] = await sql`
    select * from session_reports where conversation_id = ${conversationId}`
  return { workspace, report }
}

async function main() {
  await new Promise((resolve) => mock.listen(mockPort, '127.0.0.1', resolve))
  await seed()

  /* ------------------------------- the run, exactly as the brief describes */

  const journey = []
  for (const score of [63, 66, 61, 65]) {
    const { workspace } = await runSession(score)
    journey.push(workspace.consistency_streak)
  }
  record(
    'four sessions in the next band count up without promoting',
    journey.join(',') === '1,2,3,4',
    `streak went ${journey.join(' → ')}`,
  )

  const [before] = await sql`select official_cefr from workspaces where id = ${workspaceId}`
  record('the level has not moved yet', before.official_cefr === 'B1', before.official_cefr)

  /* -------------------------------- the fifth session promotes, right then */

  const fifth = await runSession(68)
  record(
    'the fifth session promotes immediately',
    fifth.workspace.official_cefr === 'B2',
    `official_cefr = ${fifth.workspace.official_cefr}`,
  )
  record(
    'the promotion is recorded on the session that earned it',
    fifth.report.promoted_to === 'B2',
    `report.promoted_to = ${fifth.report.promoted_to}`,
  )
  record('the consistency run resets', fifth.workspace.consistency_streak === 0)
  record(
    'the new level starts empty, not at the average that earned it',
    fifth.workspace.level_progress === 0,
    `level_progress = ${fifth.workspace.level_progress}`,
  )

  /* ------------------------------------ the report page says so, in words */

  const page = await fetch(`${base}/sessions/${fifth.report.conversation_id}`, {
    headers: { cookie: `fluentia_session=${token}` },
  })
  /*
   * React separates adjacent text nodes with comment markers, so the rendered
   * phrase is not a literal substring of the HTML. Strip the markup before
   * looking for the sentence a person would actually read.
   */
  const text = (await page.text()).replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ')
  record(
    'the session summary announces the promotion',
    /B2\s+desbloqueado/.test(text),
    page.status === 200 ? '' : `status ${page.status}`,
  )
  record(
    'and states the new level',
    /Seu novo n[ií]vel/i.test(text),
  )

  /* ------------------------------------------- a failed run keeps the bar */

  await sql`update workspaces set official_cefr='B1', level_progress=100, consistency_streak=0,
            level_achieved_at = now() where id = ${workspaceId}`
  for (const score of [63, 67, 61]) await runSession(score)
  const broken = await runSession(58) // B1, not B2 — the run fails

  record('a session outside the band resets the run', broken.workspace.consistency_streak === 0)
  record('a failed run does not move the level', broken.workspace.official_cefr === 'B1')
  record(
    'a failed run never drags the bar below 100%',
    broken.workspace.level_progress === 100,
    `level_progress = ${broken.workspace.level_progress}`,
  )

  /* ------------------------------------------------- XP cannot buy a level */

  await sql`update profiles set xp = 999999 where user_id = ${userId}`
  const [rich] = await sql`select official_cefr from workspaces where id = ${workspaceId}`
  record('a million XP does not promote anyone', rich.official_cefr === 'B1', rich.official_cefr)

  /* ------------------------------- a short session scores but does not count */

  const shortConversation = randomUUID()
  await sql`
    insert into conversations (id, user_id, workspace_id, language, topic_id, topic_label, category, level, status)
    values (${shortConversation}, ${userId}, ${workspaceId}, 'en', 'hobbies', 'Hobbies', 'daily-life', 'intermediate', 'active')`
  await sql`
    insert into conversation_messages (id, conversation_id, user_id, seq, role, content) values
      (${randomUUID()}, ${shortConversation}, ${userId}, 0, 'assistant', 'Hello there.'),
      (${randomUUID()}, ${shortConversation}, ${userId}, 1, 'user', 'Hi.')`

  const streakBefore = broken.workspace.consistency_streak
  currentScore = 68
  const short = await fetch(`${base}/api/conversations/${shortConversation}/end`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `fluentia_session=${token}` },
    body: JSON.stringify({ durationSeconds: 40, day: '2026-08-27', tzOffsetMinutes: 180 }),
  })
  const [shortReport] = await sql`
    select counts_towards_level from session_reports where conversation_id = ${shortConversation}`
  const [after] = await sql`select consistency_streak from workspaces where id = ${workspaceId}`

  record('a one-turn session still produces a report', short.ok, `status ${short.status}`)
  record(
    'but it is marked as not counting towards the level',
    shortReport?.counts_towards_level === false,
  )
  record(
    'and it leaves the consistency run untouched',
    after.consistency_streak === streakBefore,
    `${streakBefore} → ${after.consistency_streak}`,
  )


  /* ------------------------- a session left open all afternoon still closes */

  /*
   * 242:35. A conversation open past the four-hour ceiling used to answer
   * "Duração inválida" and refuse to close, trapping the learner in a session
   * they could not end. The duration is bookkeeping; ending is the point.
   */
  const longOne = await runSession(55, 14_555)
  record(
    'a session past the four-hour ceiling still closes',
    Boolean(longOne.report),
    `report ${longOne.report ? 'written' : 'missing'}`,
  )
  const [longConversation] = await sql`
    select duration_seconds from conversations where id = ${longOne.report.conversation_id}`
  record(
    'and its duration is clamped rather than refused',
    longConversation.duration_seconds === 4 * 3600,
    `duration_seconds = ${longConversation.duration_seconds}`,
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
