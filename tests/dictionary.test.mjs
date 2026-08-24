import { test } from 'node:test'
import assert from 'node:assert/strict'

const { normaliseEntries } = await import('../src/lib/dictionary/normalise.ts')

/** A trimmed copy of a real dictionaryapi.dev response. */
const REAL = [
  {
    word: 'thrive',
    phonetic: '/θɹaɪv/',
    phonetics: [
      { text: '/θɹaɪv/', audio: '' },
      { text: '/θɹaɪv/', audio: 'https://api.dictionaryapi.dev/media/pronunciations/en/thrive.mp3' },
    ],
    meanings: [
      {
        partOfSpeech: 'verb',
        definitions: [
          {
            definition: 'To grow or increase stature; to grow vigorously or luxuriantly.',
            example: 'The plants thrive in this soil.',
            synonyms: ['flourish'],
            antonyms: ['wither'],
          },
          { definition: 'To increase in wealth or success; to prosper.', synonyms: ['prosper'] },
        ],
        synonyms: ['boom'],
        antonyms: ['fail'],
      },
    ],
  },
]

test('reads a real response end to end', () => {
  const entry = normaliseEntries(REAL)

  assert.equal(entry.word, 'thrive')
  assert.equal(entry.phonetic, '/θɹaɪv/')
  assert.match(entry.audioUrl, /thrive\.mp3$/)
  assert.equal(entry.source, 'dictionaryapi.dev')

  const [verb] = entry.meanings
  assert.equal(verb.partOfSpeech, 'verb')
  assert.equal(verb.senses.length, 2)
  assert.equal(verb.senses[0].example, 'The plants thrive in this soil.')
  // A sense without an example must not invent one.
  assert.equal(verb.senses[1].example, null)
})

test('merges synonyms and antonyms from both levels of the payload', () => {
  const [verb] = normaliseEntries(REAL).meanings

  // 'boom' sits on the part of speech, 'flourish' and 'prosper' on the senses.
  assert.deepEqual(verb.synonyms.sort(), ['boom', 'flourish', 'prosper'])
  assert.deepEqual(verb.antonyms.sort(), ['fail', 'wither'])
})

test('skips the first phonetic entry when it has no audio', () => {
  // The first phonetics item carries an empty audio string, which is common.
  assert.match(normaliseEntries(REAL).audioUrl, /^https:\/\//)
})

test('survives a malformed payload instead of throwing', () => {
  for (const junk of [null, undefined, {}, [], 'nope', [null], [{ word: 'x' }]]) {
    assert.doesNotThrow(() => normaliseEntries(junk))
    assert.equal(normaliseEntries(junk), null, `expected null for ${JSON.stringify(junk)}`)
  }
})

test('drops meanings that carry no usable definition', () => {
  const entry = normaliseEntries([
    {
      word: 'half',
      meanings: [
        { partOfSpeech: 'noun', definitions: [{ definition: '' }, { example: 'orphan example' }] },
        { partOfSpeech: 'verb', definitions: [{ definition: 'To divide in two.' }] },
      ],
    },
  ])

  assert.equal(entry.meanings.length, 1)
  assert.equal(entry.meanings[0].partOfSpeech, 'verb')
})

test('an entry with nothing usable is null, not an empty shell', () => {
  assert.equal(normaliseEntries([{ word: 'ghost', meanings: [] }]), null)
})

test('related words are de-duplicated case-insensitively', () => {
  const entry = normaliseEntries([
    {
      word: 'big',
      meanings: [
        {
          partOfSpeech: 'adjective',
          definitions: [{ definition: 'Of great size.', synonyms: ['Large', 'large', 'LARGE'] }],
          synonyms: ['large'],
        },
      ],
    },
  ])

  assert.deepEqual(entry.meanings[0].synonyms, ['large'])
})

test('non-http audio is refused', () => {
  const entry = normaliseEntries([
    {
      word: 'x',
      phonetics: [{ audio: 'javascript:alert(1)' }],
      meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'A letter.' }] }],
    },
  ])

  assert.equal(entry.audioUrl, null)
})
