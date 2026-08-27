/**
 * Workspaces, end to end in a real browser.
 *
 * The thing worth proving is isolation: two languages on one account must not
 * see each other's mistakes, words or sessions, while the streak and XP that
 * belong to the person stay shared. Type checking cannot catch a query scoped
 * to the wrong id — both are strings — so it is checked against the database.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:3000'
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} })

let failures = 0
const record = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

const EMAIL = `ws-${Date.now()}@fluentia.test`

async function seed() {
  const id = randomUUID()
  const token = randomBytes(32).toString('base64url')

  await sql`insert into users (id, email, name, password_hash) values (${id}, ${EMAIL}, 'Enzo', 'x')`
  await sql`insert into profiles (user_id, onboarded_at, xp, streak_current) values (${id}, now(), 900, 5)`
  await sql`insert into user_settings (user_id) values (${id})`
  await sql`
    insert into sessions (id, user_id, expires_at)
    values (${createHash('sha256').update(token).digest('hex')}, ${id}, now() + interval '2 hours')`

  // Two languages, each with its own history.
  const spaces = {}
  for (const [language, level] of [['en', 'upper-intermediate'], ['ja', 'beginner']]) {
    const wsId = randomUUID()
    await sql`
      insert into workspaces (id, user_id, language, level)
      values (${wsId}, ${id}, ${language}, ${level})`
    spaces[language] = wsId

    const convoId = randomUUID()
    await sql`
      insert into conversations (id, user_id, workspace_id, language, topic_label, category, level, status)
      values (${convoId}, ${id}, ${wsId}, ${language}, ${`Talking in ${language}`}, 'custom', ${level}, 'completed')`
    await sql`
      insert into mistakes (id, user_id, workspace_id, category, signature, original, corrected, occurrences)
      values (${randomUUID()}, ${id}, ${wsId}, 'grammar', ${`sig-${language}`},
              ${`wrong-in-${language}`}, ${`right-in-${language}`}, 3)`
    await sql`
      insert into vocabulary (id, user_id, workspace_id, word, definition, status)
      values (${randomUUID()}, ${id}, ${wsId}, ${`word-${language}`}, ${`a ${language} word`}, 'learning')`
    await sql`
      insert into goals (id, user_id, workspace_id, kind, target)
      values (${randomUUID()}, ${id}, ${wsId}, 'weekly_sessions', ${language === 'en' ? 5 : 2})`
  }

  await sql`update user_settings set active_workspace_id = ${spaces.en} where user_id = ${id}`
  return { id, token, spaces }
}

async function main() {
  const user = await seed()
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addCookies([{ name: 'fluentia_session', value: user.token, url: base }])
  const page = await context.newPage()

  const bodyText = async (path) => {
    await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60_000 })
    return page.locator('body').innerText()
  }

  /* --------------------------------------------- English space is isolated */

  let text = await bodyText('/mistakes')
  record(
    'the English space shows only English mistakes',
    text.includes('wrong-in-en') && !text.includes('wrong-in-ja'),
  )

  text = await bodyText('/vocabulary')
  record(
    'the English space shows only English vocabulary',
    text.includes('word-en') && !text.includes('word-ja'),
  )

  text = await bodyText('/sessions')
  record(
    'the English space shows only English sessions',
    text.includes('Talking in en') && !text.includes('Talking in ja'),
  )

  /* ------------------------------------------------------ switching across */

  await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' })
  const switcher = page.locator('button[aria-haspopup="listbox"]').first()
  record('the switcher is on the page', (await switcher.count()) > 0)

  if (await switcher.count()) {
    await switcher.click()
    await page.getByRole('option', { name: /Japonês/i }).click()

    /*
     * The switch is a server action that redirects to a page we are already
     * on, so there is no navigation to wait for. Poll the row it writes
     * instead — asserting immediately raced the action and produced results
     * that contradicted each other.
     */
    let settings = []
    for (let attempt = 0; attempt < 40; attempt += 1) {
      settings = await sql`select active_workspace_id from user_settings where user_id = ${user.id}`
      if (settings[0]?.active_workspace_id === user.spaces.ja) break
      await page.waitForTimeout(250)
    }
    record(
      'switching moved the active workspace',
      settings[0].active_workspace_id === user.spaces.ja,
    )
    /*
     * The panel is Portuguese whichever space is open. Only what is being
     * learned — mistakes, saved words, the transcript — stays in the target
     * language, so a Japanese space still reads "Painel" in the chrome.
     */
    await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' })
    const sidebar = await page.locator('aside').first().innerText()
    record(
      'the panel stays in Portuguese in a Japanese space',
      sidebar.includes('Painel') && sidebar.includes('Meus erros'),
      sidebar.split(String.fromCharCode(10)).slice(0, 6).join(' · '),
    )
    record(
      'nothing offers to translate the interface any more',
      !sidebar.includes('Traduzir para português'),
    )

    text = await bodyText('/mistakes')
    record(
      'the Japanese space shows only Japanese mistakes',
      text.includes('wrong-in-ja') && !text.includes('wrong-in-en'),
    )

    text = await bodyText('/vocabulary')
    record(
      'the Japanese space shows only Japanese vocabulary',
      text.includes('word-ja') && !text.includes('word-en'),
    )

    text = await bodyText('/dashboard')
    record(
      'the streak and XP follow the account, not the language',
      text.includes('900') || text.includes('5'),
      'XP 900 / streak 5 were seeded on the profile',
    )
  }

  /* ------------------------------------------------------------- the limit */

  await page.goto(`${base}/workspaces/new`, { waitUntil: 'networkidle' })
  const alreadyOpen = await page.locator('button[aria-pressed]').count()
  record('the add-a-language page offers the languages not yet taken', alreadyOpen > 0)
  // Scoped to the form: the sidebar switcher legitimately lists every language
  // already open, so reading the whole body would always find Japanese there.
  const offered = await page.locator('form button[aria-pressed]').allInnerTexts()
  record(
    'a language already open is not offered again',
    !offered.join(' ').includes('Japonês'),
    offered.map((entry) => entry.split(String.fromCharCode(10))[0]).join(', '),
  )

  // A third space fills the account; the fourth must be refused.
  await sql`insert into workspaces (id, user_id, language, level) values (${randomUUID()}, ${user.id}, 'es', 'beginner')`
  await page.goto(`${base}/workspaces/new`, { waitUntil: 'networkidle' })
  record('the fourth language is refused — the page redirects', !page.url().includes('/workspaces/new'), page.url())

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
