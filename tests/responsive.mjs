#!/usr/bin/env node
/**
 * Measures every page at real viewport widths in a real browser.
 *
 *   node --env-file-if-exists=.env.local tests/responsive.mjs http://localhost:3000
 *
 * Reports three things per page and width:
 *   - horizontal overflow, naming the deepest element that causes it;
 *   - inputs below 16px, which make iOS Safari zoom on focus;
 *   - interactive targets under the comfortable touch size.
 *
 * It seeds an account with real content first — empty states hide the layout
 * bugs that only long words and full tables produce.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto'

import postgres from 'postgres'
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:3000'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Run with --env-file-if-exists=.env.local')
  process.exit(1)
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} })

const WIDTHS = [
  { label: 'small phone', width: 320, height: 640 },
  { label: 'phone', width: 375, height: 812 },
  { label: 'large phone', width: 414, height: 896 },
  { label: 'tablet', width: 768, height: 1024 },
  { label: 'laptop', width: 1024, height: 768 },
  { label: 'desktop', width: 1440, height: 900 },
]

/** A long word is the classic way a card breaks its container. */
const LONG = 'incomprehensibilities'

let failures = 0
const record = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

/* ---------------------------------------------------------------- fixtures */

async function seed() {
  const id = randomUUID()
  const token = randomBytes(32).toString('base64url')
  const workspaceId = randomUUID()
  const conversationId = randomUUID()

  await sql`
    insert into users (id, email, name, password_hash)
    values (${id}, ${`viewport-${Date.now()}@fluentia.test`}, ${'Responsive Tester ' + LONG}, 'x')
  `
  await sql`
    insert into profiles (user_id, onboarded_at, xp, streak_current, streak_longest,
                          total_practice_seconds, sessions_completed)
    values (${id}, now(), 2450, 12, 30, 16320, 37)
  `

  // Learning hangs off a workspace: the long word travels in its interests so
  // the settings form has something awkward to wrap.
  await sql`
    insert into workspaces (id, user_id, language, level, main_goal, estimated_cefr,
                            total_practice_seconds, sessions_completed,
                            strengths, weaknesses, interests)
    values (${workspaceId}, ${id}, 'en', 'upper-intermediate', 'career', 'B2', 16320, 37,
            ${sql.json(['Vocabulary', 'Listening'])}, ${sql.json(['Prepositions', 'Verb tenses'])},
            ${sql.json(['technology', LONG])})
  `
  await sql`insert into user_settings (user_id, active_workspace_id, openai_key_hint, openai_key_status)
            values (${id}, ${workspaceId}, '1234', 'ok')`
  await sql`
    insert into sessions (id, user_id, expires_at)
    values (${createHash('sha256').update(token).digest('hex')}, ${id}, now() + interval '1 hour')
  `

  for (const [kind, target] of [
    ['weekly_sessions', 5],
    ['weekly_minutes', 100],
    ['weekly_words', 20],
    ['weekly_mistakes', 10],
  ]) {
    await sql`insert into goals (id, user_id, workspace_id, kind, target)
              values (${randomUUID()}, ${id}, ${workspaceId}, ${kind}, ${target})`
  }

  await sql`
    insert into conversations (id, user_id, workspace_id, language, topic_id, topic_label, category, level, status,
                               duration_seconds, user_turns, ended_at)
    values (${conversationId}, ${id}, ${workspaceId}, 'en', 'job-interview', 'Job interview', 'career',
            'upper-intermediate', 'completed', 620, 6, now())
  `

  const messageId = randomUUID()
  await sql`
    insert into conversation_messages (id, conversation_id, user_id, seq, role, content) values
      (${randomUUID()}, ${conversationId}, ${id}, 0, 'assistant', 'Tell me about your current job and what a normal week looks like for you.'),
      (${messageId}, ${conversationId}, ${id}, 1, 'user', ${`I work in this company since 2025 and I treat data every day, ${LONG}.`})
  `

  await sql`
    insert into corrections (id, user_id, conversation_id, message_id, category, original,
                             corrected, explanation, better_sentence, severity) values
      (${randomUUID()}, ${id}, ${conversationId}, ${messageId}, 'grammar', 'I work in',
       ${"I've worked at"}, 'Since 2025 needs the present perfect.',
       ${"I've worked at this company since 2025."}, 3),
      (${randomUUID()}, ${id}, ${conversationId}, ${messageId}, 'vocabulary', 'treat data',
       'analyse data', ${`We analyse data; ${LONG} is not a word you want here.`}, '', 2)
  `

  await sql`
    insert into session_reports (id, conversation_id, user_id, workspace_id, speaking, grammar, vocabulary,
                                 fluency, pronunciation, estimated_level, summary, main_mistakes,
                                 new_words, expressions, recommendations, words_spoken)
    values (${randomUUID()}, ${conversationId}, ${id}, ${workspaceId}, 78, 72, 84, 76, null, 'B2',
            ${`You kept the conversation going well. Watch your tenses, and mind ${LONG}.`},
            ${sql.json([{ label: 'Past tense', detail: 'You said "I go" about yesterday.' }])},
            ${sql.json([{ word: LONG, meaning: 'A deliberately long word for layout testing.' }])},
            ${sql.json([{ expression: 'meet a deadline', meaning: 'Finish in time.' }])},
            ${sql.json(['Try a conversation about your last weekend.'])}, 320)
  `

  for (const [category, original, corrected, count] of [
    ['prepositions', 'depend of', 'depend on', 7],
    ['grammar', 'I have went', 'I have gone', 5],
    ['naturalness', `I am agree with ${LONG}`, `I agree with ${LONG}`, 4],
  ]) {
    await sql`
      insert into mistakes (id, user_id, workspace_id, category, signature, original, corrected, explanation, occurrences)
      values (${randomUUID()}, ${id}, ${workspaceId}, ${category}, ${`${category}:${original}>${corrected}`},
              ${original}, ${corrected}, ${`In English we say "${corrected}".`}, ${count})
    `
  }

  for (const word of ['entrepreneurship', LONG, 'deadline']) {
    await sql`
      insert into vocabulary (id, user_id, workspace_id, word, part_of_speech, phonetic, definition, example, status)
      values (${randomUUID()}, ${id}, ${workspaceId}, ${word}, 'noun', '/ˌɒn.trə.prə.nɜːˈʃɪp/',
              ${`A definition long enough to wrap on a narrow screen, mentioning ${LONG} twice: ${LONG}.`},
              ${`An example sentence using ${word} in context.`}, 'learning')
    `
  }

  const liveId = randomUUID()
  await sql`
    insert into conversations (id, user_id, workspace_id, language, topic_id, topic_label, category, level, status,
                               duration_seconds, user_turns)
    values (${liveId}, ${id}, ${workspaceId}, 'en', null, ${`Negotiating ${LONG} at work`}, 'custom',
            'upper-intermediate', 'active', 95, 2)
  `

  const liveMessageId = randomUUID()
  await sql`
    insert into conversation_messages (id, conversation_id, user_id, seq, role, content) values
      (${randomUUID()}, ${liveId}, ${id}, 0, 'assistant', ${`So, tell me — how do you usually handle ${LONG} when a deadline is close?`}),
      (${liveMessageId}, ${liveId}, ${id}, 1, 'user', ${`I am agree with you, I think ${LONG} is very difficult for me and I work in it since 2025.`})
  `

  await sql`
    insert into corrections (id, user_id, conversation_id, message_id, category, original,
                             corrected, explanation, better_sentence, severity) values
      (${randomUUID()}, ${id}, ${liveId}, ${liveMessageId}, 'grammar', 'I am agree with you',
       'I agree with you', ${`"Agree" is already a verb, so ${LONG} of "am" here.`},
       'I agree with you.', 3)
  `

  await sql`insert into user_achievements (user_id, achievement_id) values (${id}, 'first-conversation')`

  return { id, token, conversationId, liveId }
}

/* ------------------------------------------------------------------ audit */

/** Runs inside the page: finds what actually sticks out. */
const AUDIT = (checkZoom) => {
  const docWidth = document.documentElement.clientWidth
  const offenders = []
  const smallInputs = []
  const smallTargets = []

  const overflowing = new Set()

  for (const el of document.querySelectorAll('body *')) {
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue

    const style = getComputedStyle(el)
    if (style.visibility === 'hidden' || style.opacity === '0') continue

    /*
     * Content inside a deliberately scrollable box — a swipeable strip, a wide
     * table — is allowed to be wider than the screen. What matters is whether
     * the page itself can be dragged sideways.
     */
    let inScroller = false
    for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const overflowX = getComputedStyle(parent).overflowX
      if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden') {
        inScroller = true
        break
      }
    }

    if (!inScroller && (rect.right > docWidth + 1 || rect.left < -1)) overflowing.add(el)

    // Only phones: iOS Safari zooms on focus below 16px. On a desktop the
    // smaller size is the intended design and nothing zooms.
    if (checkZoom && el.matches('input, select, textarea')) {
      const size = parseFloat(style.fontSize)
      if (size < 16) {
        smallInputs.push({ tag: el.tagName.toLowerCase(), name: el.name || el.type, size })
      }
    }

    if (el.matches('button, a[href], [role="button"], [role="combobox"]')) {
      const tooSmall = rect.height < 32 || rect.width < 32
      const hasText = (el.textContent || '').trim().length > 0
      if (tooSmall && !hasText) {
        smallTargets.push({
          label: el.getAttribute('aria-label') || el.className.slice(0, 40),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        })
      }
    }
  }

  // Only report the deepest offenders: a parent that overflows because of its
  // child is noise.
  for (const el of overflowing) {
    if ([...overflowing].some((other) => other !== el && el.contains(other))) continue
    const rect = el.getBoundingClientRect()
    offenders.push({
      tag: el.tagName.toLowerCase(),
      cls: (typeof el.className === 'string' ? el.className : '').slice(0, 70),
      text: (el.textContent || '').trim().slice(0, 40),
      right: Math.round(rect.right),
      width: Math.round(rect.width),
    })
  }

  /*
   * The voice room claims the whole screen, so its own arithmetic has to land
   * inside the viewport: a mic button pushed below the fold is unreachable
   * exactly when you need it.
   */
  const room = document.querySelector('[data-room]')
  const mic = document.querySelector('[data-mic]')
  const roomFit = room
    ? {
        overshoot: Math.round(room.getBoundingClientRect().bottom - window.innerHeight),
        micBottom: mic ? Math.round(mic.getBoundingClientRect().bottom) : null,
        micSize: mic ? Math.round(mic.getBoundingClientRect().height) : null,
        viewport: window.innerHeight,
      }
    : null

  return {
    roomFit,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: docWidth,
    offenders: offenders.slice(0, 4),
    smallInputs: smallInputs.slice(0, 4),
    smallTargets: smallTargets.slice(0, 4),
  }
}

/**
 * Opens the three things a phone user actually taps into — the nav sheet, a
 * dropdown, and the end-session dialog — and checks each one lands inside the
 * screen with tappable rows.
 */
async function auditOverlays(page, base, viewport, user) {
  const measure = () =>
    page.evaluate(() => {
      const panel = document.querySelector('[role="dialog"], [role="listbox"]')
      if (!panel) return null
      const rect = panel.getBoundingClientRect()
      const rows = [...panel.querySelectorAll('a, button, [role="option"]')].map((el) =>
        Math.round(el.getBoundingClientRect().height),
      )
      return {
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        width: window.innerWidth,
        height: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        smallestRow: rows.length ? Math.min(...rows) : null,
      }
    })

  const check = async (label, fits) => {
    const box = await measure()
    if (!box) return record(`${viewport.label.padEnd(12)} ${label}`, false, 'nothing opened')
    const inside =
      box.left >= -1 && box.right <= box.width + 1 && box.scrollWidth <= box.width + 1
    record(
      `${viewport.label.padEnd(12)} ${label}`,
      inside && fits(box),
      `x ${box.left}…${box.right} of ${box.width} · y ${box.top}…${box.bottom} of ${box.height}` +
        (box.smallestRow === null ? '' : ` · smallest row ${box.smallestRow}px`),
    )
  }

  // 1. The bottom-sheet nav (phones only — it is hidden from lg up).
  if (viewport.width < 1024) {
    await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' })
    const more = page.locator('button[aria-label="More sections"]')
    if (await more.count()) {
      await more.tap()
      await page.waitForSelector('[role="dialog"]')
      await check('nav sheet on touch', (b) => b.bottom <= b.height + 1 && b.smallestRow >= 40)
      await page.keyboard.press('Escape').catch(() => {})
    }
  }

  // 2. A dropdown near the bottom of a long form — the case that used to open
  //    off the screen.
  await page.goto(`${base}/settings`, { waitUntil: 'networkidle' })
  const combos = page.locator('[role="combobox"]')
  const last = combos.nth((await combos.count()) - 1)
  await last.scrollIntoViewIfNeeded()
  await last.tap()
  await page.waitForSelector('[role="listbox"]')
  await check('dropdown on touch', (b) => b.top >= -1 && b.bottom <= b.height + 1 && b.smallestRow >= 40)

  // 3. The end-session dialog, over the voice room.
  await page.goto(`${base}/speak/${user.liveId}`, { waitUntil: 'networkidle' })
  const end = page.locator('button', { hasText: /^End/ }).first()
  if (await end.count()) {
    await end.tap()
    await page.waitForSelector('[role="dialog"], [aria-modal="true"]').catch(() => {})
    await check('end-session dialog on touch', (b) => b.bottom <= b.height + 1)
  }
}

async function main() {
  const user = await seed()
  const browser = await chromium.launch()

  const pages = [
    ['/', false],
    ['/login', false],
    ['/signup', false],
    ['/dashboard', true],
    ['/speak', true],
    [`/speak/${user.liveId}`, true],
    ['/sessions', true],
    [`/sessions/${user.conversationId}`, true],
    ['/mistakes', true],
    [`/mistakes?open=`, true],
    ['/vocabulary', true],
    ['/profile', true],
    ['/goals', true],
    ['/achievements', true],
    ['/settings', true],
  ]

  const inputIssues = new Map()
  const targetIssues = new Map()

  for (const viewport of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 2,
      isMobile: viewport.width < 768,
      hasTouch: viewport.width < 1024,
    })
    await context.addCookies([
      { name: 'fluentia_session', value: user.token, url: base },
    ])

    const page = await context.newPage()
    let clean = 0

    for (const [path] of pages) {
      try {
        await page.goto(base + path, { waitUntil: 'networkidle', timeout: 30_000 })
      } catch {
        record(`${viewport.label} ${path}`, false, 'page did not load')
        continue
      }

      const result = await page.evaluate(AUDIT, viewport.width < 768)
      const overflows = result.scrollWidth > result.clientWidth + 1

      if (result.roomFit) {
        const fit = result.roomFit
        record(
          `${viewport.label.padEnd(12)} voice room fits the screen`,
          fit.overshoot <= 1 && fit.micBottom !== null && fit.micBottom <= fit.viewport,
          `overshoot ${fit.overshoot}px · mic ends at ${fit.micBottom}/${fit.viewport}px · mic ${fit.micSize}px tall`,
        )
      }

      if (overflows || result.offenders.length > 0) {
        record(
          `${viewport.label.padEnd(12)} ${path}`,
          false,
          `${result.scrollWidth}px wide in ${result.clientWidth}px`,
        )
        for (const o of result.offenders) {
          console.log(`         ↳ <${o.tag}> w=${o.width} right=${o.right} "${o.text}" · ${o.cls}`)
        }
      } else {
        clean += 1
      }

      for (const i of result.smallInputs) {
        inputIssues.set(`${i.tag}[${i.name}] ${i.size}px`, true)
      }
      for (const t of result.smallTargets) {
        targetIssues.set(`${t.label} ${t.w}×${t.h}`, true)
      }
    }

    record(`${viewport.label} (${viewport.width}px) — no horizontal overflow`, clean === pages.length, `${clean}/${pages.length} pages clean`)

    // Overlays only exist once something is tapped, so a page-load sweep never
    // sees them. Drive them on a touch screen and measure what appears.
    if (viewport.width < 1024) await auditOverlays(page, base, viewport, user)

    await context.close()
  }

  await browser.close()

  console.log('\n--- iOS zoom triggers (inputs under 16px) ---')
  if (inputIssues.size === 0) console.log('  none')
  else for (const issue of inputIssues.keys()) console.log('  ' + issue)
  record('no input smaller than 16px', inputIssues.size === 0, `${inputIssues.size} found`)

  console.log('\n--- touch targets under 32px (icon-only) ---')
  if (targetIssues.size === 0) console.log('  none')
  else for (const issue of [...targetIssues.keys()].slice(0, 12)) console.log('  ' + issue)
  record('no icon target under 32px', targetIssues.size === 0, `${targetIssues.size} found`)

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`)
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
