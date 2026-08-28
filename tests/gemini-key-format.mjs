/**
 * The two Gemini key formats, checked where the learner actually types them.
 *
 * Google issues both a classic `AIza…` API key and a newer AI Studio auth key
 * that starts with `AQ.` — and the dot in that prefix is what the old pattern
 * choked on, so a perfectly valid key came back as "not a Gemini key".
 *
 * A unit test can prove the regular expression accepts it. Only this can prove
 * nothing between the form and the provider rejects it first, which is exactly
 * how the last version of this bug hid: the shape check that ran and won was
 * not the one anybody had looked at.
 *
 * The keys below are invented, so Google refuses them — and that refusal is
 * the pass condition. It can only be reached by a key that got all the way
 * through the app's own checks.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:3100'
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} })

let failures = 0
const record = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

const EMAIL = `key-${Date.now()}@fluentia.test`
const userId = randomUUID()
const token = randomBytes(32).toString('base64url')

async function seed() {
  await sql`insert into users (id, email, name, password_hash) values (${userId}, ${EMAIL}, 'Enzo', 'x')`
  await sql`insert into profiles (user_id, onboarded_at) values (${userId}, now())`
  const wsId = randomUUID()
  await sql`insert into workspaces (id, user_id, language, level) values (${wsId}, ${userId}, 'en', 'beginner')`
  await sql`insert into user_settings (user_id, active_workspace_id, ai_provider)
            values (${userId}, ${wsId}, 'gemini')`
  await sql`insert into sessions (id, user_id, expires_at)
            values (${createHash('sha256').update(token).digest('hex')}, ${userId}, now() + interval '2 hours')`
}

/** The complaint the app makes when it decides a key is the wrong shape. */
const SHAPE_COMPLAINT = /não parece uma chave/i

async function main() {
  await seed()
  const browser = await chromium.launch()
  const context = await browser.newContext()
  await context.addCookies([
    { name: 'fluentia_session', value: token, domain: 'localhost', path: '/' },
  ])
  const page = await context.newPage()

  /*
   * Waiting on the server action's own response, not on words appearing in the
   * page. The first version of this waited for text like "verific", which the
   * static hint already contained — so it read the form before the answer
   * arrived and reported a pass on nothing.
   */
  const submit = async (key) => {
    await page.goto(`${base}/settings`, { waitUntil: 'networkidle' })
    const field = page.locator('input[name="apiKey"]')
    await field.fill(key)
    const form = page.locator('form:has(input[name="apiKey"])')
    const before = await form.innerText()

    await Promise.all([
      page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/settings'), {
        timeout: 60_000,
      }),
      field.press('Enter'),
    ])

    /*
     * The response landing is not the same moment as React showing it, and a
     * call that goes out to Google takes long enough for the gap to matter.
     * Waiting for the form's own text to change catches the render itself —
     * waiting for "a paragraph" did not, because the hint is always one.
     */
    await page.waitForFunction(
      (previous) => {
        const node = document.querySelector('form:has(input[name="apiKey"])')
        return Boolean(node) && node.innerText.trim() !== previous
      },
      before.trim(),
      { timeout: 60_000 },
    )
    return form.innerText()
  }

  /* The panel must be offering Gemini, or the rest proves nothing. */
  const settings = await page.goto(`${base}/settings`, { waitUntil: 'networkidle' })
  record('the settings page loads', settings.ok(), `status ${settings.status()}`)
  const body = await page.locator('body').innerText()
  record('Gemini is the selected provider', /Gemini/i.test(body))

  /* --- the new auth key format ------------------------------------------ */
  const aq = await submit('AQ.Ab8RN6JcK3mQ7vX2pL9wZ0aT4sY1nB5dE7fG9hJ2kL')
  record(
    'an AQ. auth key is not turned away as the wrong shape',
    !SHAPE_COMPLAINT.test(aq),
    aq.replace(/\s+/g, ' ').slice(0, 150),
  )
  record(
    'it reaches Google, which is what refuses it',
    /recusou|inválid|não está respondendo/i.test(aq),
    aq.replace(/\s+/g, ' ').slice(0, 150),
  )

  const [afterAq] = await sql`select gemini_key_status from user_settings where user_id = ${userId}`
  record(
    'and the app records what Google said about it, rather than nothing',
    afterAq.gemini_key_status === 'invalid',
    `status ${afterAq.gemini_key_status}`,
  )

  /* --- the classic format still works ----------------------------------- */
  const aiza = await submit('AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ0123456')
  record(
    'the classic AIza key still gets through the shape check',
    !SHAPE_COMPLAINT.test(aiza),
    aiza.replace(/\s+/g, ' ').slice(0, 150),
  )

  /* --- and the wrong provider's key is still caught locally -------------- */
  const openai = await submit('sk-proj-abcdefghijklmnopqrstuvwxyz012345')
  record(
    'an OpenAI key is still refused, by name, before any network call',
    SHAPE_COMPLAINT.test(openai) && /Gemini/i.test(openai),
    openai.replace(/\s+/g, ' ').slice(0, 150),
  )
  record(
    'and the hint it gives names both accepted formats',
    /AIza/.test(openai) && /AQ\./.test(openai),
    openai.replace(/\s+/g, ' ').slice(0, 150),
  )

  /* --- a refused key is never left looking usable ------------------------ */
  /*
   * The app keeps a key Google refused rather than discarding it — that is
   * deliberate, so "Testar conexão" can be pressed again once billing or a
   * quota is sorted out. What must never happen is it being recorded as `ok`.
   */
  const [row] = await sql`
    select gemini_key_status, gemini_key_verified_at from user_settings where user_id = ${userId}`
  record(
    'a key Google refused is recorded as invalid, never as working',
    row.gemini_key_status === 'invalid' && row.gemini_key_verified_at === null,
    `status ${row.gemini_key_status}, verified ${row.gemini_key_verified_at}`,
  )

  await browser.close()
  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
  process.exitCode = failures === 0 ? 0 : 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await sql`delete from users where email like '%@fluentia.test'`
    await sql.end()
  })
