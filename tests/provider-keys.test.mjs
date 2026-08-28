import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { PROVIDERS, PROVIDER_IDS, resolveVoice, getProvider, keyHint } = await import(
  '../src/lib/ai/provider.ts'
)

/* ----------------------------------------------------------- key patterns */

test('each provider recognises its own key', () => {
  assert.ok(PROVIDERS.openai.keyPattern.test('sk-proj-abcdefghijklmnopqrstuvwxyz012345'))
  assert.ok(PROVIDERS.gemini.keyPattern.test('AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ0123456'))
})

test('Google issues two key formats, and both are accepted', () => {
  // The legacy API key, and the newer AI Studio auth key. The auth key
  // contains dots — the character class used to reject it outright, so a real
  // key came back as "not a Gemini key".
  assert.ok(
    PROVIDERS.gemini.keyPattern.test('AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ0123456'),
    'the AIza format must keep working',
  )
  assert.ok(
    PROVIDERS.gemini.keyPattern.test('AQ.Ab8RN6JcK3mQ7vX2pL9wZ0aT4sY1nB5dE'),
    'the AQ. auth key format must be accepted',
  )
  assert.ok(
    PROVIDERS.gemini.keyPattern.test('AQ.Ab8RN6_Jc-K3mQ7vX2pL9wZ.0aT4sY1nB5dE'),
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
    PROVIDERS.gemini.keyPattern.test('sk-proj-abcdefghijklmnopqrstuvwxyz012345'),
    false,
    'an OpenAI key must not pass as a Gemini key',
  )
  assert.equal(
    PROVIDERS.openai.keyPattern.test('AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ0123456'),
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
