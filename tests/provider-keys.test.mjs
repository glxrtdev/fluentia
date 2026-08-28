import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  FAKE_GEMINI_AUTH_KEY,
  FAKE_GEMINI_AUTH_KEY_PUNCTUATED,
  FAKE_GEMINI_KEY,
  FAKE_OPENAI_KEY,
} from './fake-keys.mjs'
import { readdirSync, readFileSync } from 'node:fs'

const { PROVIDERS, PROVIDER_IDS, resolveVoice, getProvider, keyHint } = await import(
  '../src/lib/ai/provider.ts'
)

/* ----------------------------------------------------------- key patterns */

test('each provider recognises its own key', () => {
  assert.ok(PROVIDERS.openai.keyPattern.test(FAKE_OPENAI_KEY))
  assert.ok(PROVIDERS.gemini.keyPattern.test(FAKE_GEMINI_KEY))
})

test('Google issues two key formats, and both are accepted', () => {
  // The legacy API key, and the newer AI Studio auth key. The auth key
  // contains dots — the character class used to reject it outright, so a real
  // key came back as "not a Gemini key".
  assert.ok(
    PROVIDERS.gemini.keyPattern.test(FAKE_GEMINI_KEY),
    'the AIza format must keep working',
  )
  assert.ok(
    PROVIDERS.gemini.keyPattern.test(FAKE_GEMINI_AUTH_KEY),
    'the AQ. auth key format must be accepted',
  )
  assert.ok(
    PROVIDERS.gemini.keyPattern.test(FAKE_GEMINI_AUTH_KEY_PUNCTUATED),
    'dots, underscores and hyphens all appear in real auth keys',
  )
})

test('every prefix a provider claims is one its pattern accepts', () => {
  // The guarantee that matters: adding a prefix to the list without widening
  // the pattern would advertise a format the app then refuses.
  for (const id of PROVIDER_IDS) {
    for (const prefix of PROVIDERS[id].keyPrefixes) {
      assert.ok(
        PROVIDERS[id].keyPattern.test(prefix + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6'),
        `${id}: claims "${prefix}" but the pattern rejects it`,
      )
    }
  }
})

test('the hint names every format, so nobody is told the wrong one', () => {
  const hint = keyHint(PROVIDERS.gemini)
  for (const prefix of PROVIDERS.gemini.keyPrefixes) {
    assert.ok(hint.includes(prefix), `the hint should mention "${prefix}" — got "${hint}"`)
  }
  assert.equal(keyHint(PROVIDERS.openai), 'Formatos aceitos: sk-…')
  // "AQ." ends in a dot; the hint must not run it into a full stop and read "AQ..".
  assert.ok(!/\.\./.test(hint), `the hint reads badly: "${hint}"`)
})

test('and refuses the other provider’s key', () => {
  // The bug: a valid Gemini key was answered with "OpenAI keys start with sk-".
  assert.equal(
    PROVIDERS.gemini.keyPattern.test(FAKE_OPENAI_KEY),
    false,
    'an OpenAI key must not pass as a Gemini key',
  )
  assert.equal(
    PROVIDERS.openai.keyPattern.test(FAKE_GEMINI_KEY),
    false,
    'a Gemini key must not pass as an OpenAI key',
  )
})

test('junk is refused by both', () => {
  for (const id of PROVIDER_IDS) {
    for (const value of ['', 'x', 'sua chave aqui', 'sk-', 'AIza', 'AQ.', 'AQ']) {
      assert.equal(PROVIDERS[id].keyPattern.test(value), false, `${id} accepted "${value}"`)
    }
  }
})

/* ------------------------------------------------- no provider hardcoding */

test('the shared key schema names no provider', () => {
  // It cannot know which provider is selected, so it must not claim a shape.
  const source = readFileSync('src/lib/validation.ts', 'utf8')
  const schema = source.slice(source.indexOf('export const apiKeySchema'))
  const body = schema.slice(0, schema.indexOf('})') + 2)
  assert.ok(!/OpenAI|sk-|AIza/.test(body), `the schema still hardcodes a provider:\n${body}`)
})

/* ------------------------------------------------------------------ voices */

test('switching provider never leaves another provider’s voice selected', () => {
  // 'alloy' is OpenAI's; a Gemini request carrying it would be rejected.
  assert.equal(resolveVoice('gemini', 'alloy'), PROVIDERS.gemini.voices[0].id)
  assert.equal(resolveVoice('openai', 'Zephyr'), PROVIDERS.openai.voices[0].id)
})

test('a voice that does belong to the provider is kept', () => {
  assert.equal(resolveVoice('openai', 'shimmer'), 'shimmer')
  assert.equal(resolveVoice('gemini', 'Kore'), 'Kore')
})

test('a missing or unknown provider falls back rather than blanking the page', () => {
  assert.equal(getProvider(null).id, 'openai')
  assert.equal(getProvider('claude').id, 'openai')
  assert.equal(resolveVoice('openai', null), PROVIDERS.openai.voices[0].id)
})

/* --------------------------------------------------- what the source holds */

test('no file plants a literal that reads as a real credential', () => {
  /*
   * GitHub's secret scanning mailed a "secrets detected" alert about two test
   * fixtures. Nothing real had leaked — but a scanner matches the shape, and
   * it cannot tell a key spelled TESTKEYNOTREAL from a live one. A repository
   * that keeps crying wolf is one where the alert that finally matters gets
   * waved away with the rest, so the fixtures are assembled from parts in
   * `fake-keys.mjs` and no whole key-shaped string is written down.
   *
   * This guards that arrangement: spell one out anywhere and it fails here,
   * rather than in an email days after it was pushed.
   */
  const SHAPED = /AIza[A-Za-z0-9_-]{30,}|AQ\.[A-Za-z0-9._-]{25,}|sk-[A-Za-z0-9_-]{30,}/

  const offenders = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`
      if (entry.isDirectory()) {
        walk(path)
        continue
      }
      if (!/\.(mjs|js|ts|tsx|md)$/.test(entry.name)) continue
      // The one file allowed to name the parts — and it never joins them.
      if (path.endsWith('tests/fake-keys.mjs')) continue

      const lines = readFileSync(path, 'utf8').split('\n')
      lines.forEach((line, index) => {
        const found = SHAPED.exec(line)
        if (found) offenders.push(`${path}:${index + 1} → ${found[0].slice(0, 16)}...`)
      })
    }
  }

  for (const root of ['tests', 'src', 'scripts']) walk(root)

  assert.deepEqual(
    offenders,
    [],
    `key-shaped literals found — build them in tests/fake-keys.mjs instead:\n${offenders.join('\n')}`,
  )
})

