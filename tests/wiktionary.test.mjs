import { test } from 'node:test'
import assert from 'node:assert/strict'

const { normaliseWiktionary } = await import('../src/lib/dictionary/wiktionary.ts')

/* The shape Wiktionary actually returns, trimmed to what matters here. */
const PAYLOAD = {
  es: [
    {
      partOfSpeech: 'Noun',
      language: 'Spanish',
      definitions: [
        { definition: '<a href="/wiki/house">house</a>', examples: ['Vivo en una <b>casa</b>.'] },
        { definition: 'home' },
      ],
    },
  ],
  gl: [{ partOfSpeech: 'Noun', definitions: [{ definition: 'a Galician house' }] }],
  it: [{ partOfSpeech: 'Noun', definitions: [{ definition: 'an Italian house' }] }],
}

test('keeps only the language being learned', () => {
  const entry = normaliseWiktionary('casa', 'es', PAYLOAD)
  assert.equal(entry.meanings.length, 1)
  assert.equal(entry.meanings[0].senses[0].definition, 'house')
  const all = JSON.stringify(entry)
  assert.ok(!all.includes('Galician'), 'a Galician sense leaked into a Spanish lookup')
  assert.ok(!all.includes('Italian'), 'an Italian sense leaked into a Spanish lookup')
})

test('markup is unwrapped, not shown', () => {
  const entry = normaliseWiktionary('casa', 'es', PAYLOAD)
  assert.equal(entry.meanings[0].senses[0].example, 'Vivo en una casa.')
  assert.ok(!JSON.stringify(entry).includes('<'))
})

test('part of speech comes through lowercased', () => {
  assert.equal(normaliseWiktionary('casa', 'es', PAYLOAD).meanings[0].partOfSpeech, 'noun')
})

test('a word with no section in this language is a miss, not an empty card', () => {
  assert.equal(normaliseWiktionary('casa', 'ja', PAYLOAD), null)
})

test('junk payloads do not throw', () => {
  for (const value of [null, undefined, 'nope', 42, {}, { es: [] }, { es: 'x' }]) {
    assert.doesNotThrow(() => normaliseWiktionary('casa', 'es', value))
    assert.equal(normaliseWiktionary('casa', 'es', value), null)
  }
})

test('a section with no usable definitions is dropped', () => {
  const entry = normaliseWiktionary('casa', 'es', {
    es: [{ partOfSpeech: 'Noun', definitions: [{ definition: '   ' }] }],
  })
  assert.equal(entry, null)
})

test('the source is credited as wiktionary', () => {
  assert.equal(normaliseWiktionary('casa', 'es', PAYLOAD).source, 'wiktionary')
})
