/**
 * The languages Fluentia can teach.
 *
 * Everything that has to change when a learner switches workspace is declared
 * here — how the teacher is told to speak, what the speech-to-text model should
 * expect, where definitions come from, and how the interface should greet
 * someone taking on a writing system they cannot yet read.
 *
 * Pure data with no imports, so it is safe on the server, in the browser and in
 * scripts alike.
 */

export type LanguageCode =
  | 'en'
  | 'es'
  | 'fr'
  | 'it'
  | 'de'
  | 'pt'
  | 'ja'
  | 'ko'
  | 'zh'
  | 'ru'

/**
 * How far the language sits from Portuguese, for a Brazilian learner.
 *
 * This is not a judgement about the language: it decides how much scaffolding
 * the interface offers. A learner meeting kana for the first time should not
 * also have to read the app in a foreign language, so anything above `close`
 * opens its workspace with the interface in Portuguese.
 */
export type LanguageDistance = 'close' | 'moderate' | 'far'

export type Language = {
  code: LanguageCode
  /** What the language calls itself. Always shown, never translated. */
  nativeName: string
  /** The name in English and in Portuguese, for the interface. */
  name: { en: string; pt: string }
  /**
   * Two letters shown in the language badge.
   *
   * Not a flag emoji: Windows ships no glyphs for regional-indicator pairs, so
   * every flag rendered as the bare letters anyway — and a flag is the wrong
   * symbol for a language in the first place.
   */
  badge: string
  distance: LanguageDistance
  /** ISO-639-1 code handed to the transcription model. */
  sttCode: string
  /** BCP-47 tag, for `lang` attributes and speech synthesis. */
  bcp47: string
  /** Written right to left. None of the current set are, but the field keeps
   *  the assumption visible rather than buried. */
  rtl: boolean
  /**
   * Wiktionary's language section key. Definitions for every language are
   * served from the English Wiktionary, keyed by this code.
   */
  wiktionary: string
  /**
   * True when the free dictionary at dictionaryapi.dev serves this language.
   * Only English works in practice — the other endpoints time out at the
   * origin — so everything else goes to Wiktionary.
   */
  freeDictionary: boolean
  /** A short line for the teacher prompt about what trips learners up. */
  teachingNotes: string
  /** The word offered when previewing a voice, in the language itself. */
  voiceSample: string
}

export const LANGUAGES: Language[] = [
  {
    code: 'en',
    nativeName: 'English',
    name: { en: 'English', pt: 'Inglês' },
    badge: 'EN',
    distance: 'moderate',
    sttCode: 'en',
    bcp47: 'en-US',
    rtl: false,
    wiktionary: 'en',
    freeDictionary: true,
    teachingNotes:
      'Watch for tense agreement, prepositions, false friends from Portuguese, and word order in questions.',
    voiceSample: 'Hello! I am your teacher. Shall we start talking?',
  },
  {
    code: 'es',
    nativeName: 'Español',
    name: { en: 'Spanish', pt: 'Espanhol' },
    badge: 'ES',
    distance: 'close',
    sttCode: 'es',
    bcp47: 'es-ES',
    rtl: false,
    wiktionary: 'es',
    freeDictionary: false,
    teachingNotes:
      'Portuguese speakers lean on portunhol: watch for false friends, ser vs estar, and por vs para.',
    voiceSample: '¡Hola! Soy tu profesor. ¿Empezamos a hablar?',
  },
  {
    code: 'fr',
    nativeName: 'Français',
    name: { en: 'French', pt: 'Francês' },
    badge: 'FR',
    distance: 'moderate',
    sttCode: 'fr',
    bcp47: 'fr-FR',
    rtl: false,
    wiktionary: 'fr',
    freeDictionary: false,
    teachingNotes:
      'Watch for gender agreement, liaison in speech, and the difference between passé composé and imparfait.',
    voiceSample: 'Bonjour ! Je suis votre professeur. On commence à parler ?',
  },
  {
    code: 'it',
    nativeName: 'Italiano',
    name: { en: 'Italian', pt: 'Italiano' },
    badge: 'IT',
    distance: 'close',
    sttCode: 'it',
    bcp47: 'it-IT',
    rtl: false,
    wiktionary: 'it',
    freeDictionary: false,
    teachingNotes:
      'Watch for double consonants, article contractions, and the subjunctive after opinion verbs.',
    voiceSample: 'Ciao! Sono il tuo insegnante. Cominciamo a parlare?',
  },
  {
    code: 'de',
    nativeName: 'Deutsch',
    name: { en: 'German', pt: 'Alemão' },
    badge: 'DE',
    distance: 'far',
    sttCode: 'de',
    bcp47: 'de-DE',
    rtl: false,
    wiktionary: 'de',
    freeDictionary: false,
    teachingNotes:
      'Watch for case endings, verb-final word order in subordinate clauses, and separable verbs.',
    voiceSample: 'Hallo! Ich bin dein Lehrer. Wollen wir anfangen zu sprechen?',
  },
  {
    code: 'pt',
    nativeName: 'Português',
    name: { en: 'Portuguese', pt: 'Português' },
    badge: 'PT',
    distance: 'close',
    sttCode: 'pt',
    bcp47: 'pt-PT',
    rtl: false,
    wiktionary: 'pt',
    freeDictionary: false,
    teachingNotes:
      'European Portuguese: watch for the personal infinitive, clitic placement, and vowel reduction in speech.',
    voiceSample: 'Olá! Sou o teu professor. Vamos começar a falar?',
  },
  {
    code: 'ja',
    nativeName: '日本語',
    name: { en: 'Japanese', pt: 'Japonês' },
    badge: 'JA',
    distance: 'far',
    sttCode: 'ja',
    bcp47: 'ja-JP',
    rtl: false,
    wiktionary: 'ja',
    freeDictionary: false,
    teachingNotes:
      'Watch for particle choice, politeness level, and counter words. Write in normal Japanese script, not romaji.',
    voiceSample: 'こんにちは！わたしはあなたの先生です。話しはじめましょうか？',
  },
  {
    code: 'ko',
    nativeName: '한국어',
    name: { en: 'Korean', pt: 'Coreano' },
    badge: 'KO',
    distance: 'far',
    sttCode: 'ko',
    bcp47: 'ko-KR',
    rtl: false,
    wiktionary: 'ko',
    freeDictionary: false,
    teachingNotes:
      'Watch for speech level, particle choice, and verb endings. Write in Hangul, not romanisation.',
    voiceSample: '안녕하세요! 저는 당신의 선생님입니다. 이야기를 시작할까요?',
  },
  {
    code: 'zh',
    nativeName: '中文',
    name: { en: 'Mandarin Chinese', pt: 'Chinês (mandarim)' },
    badge: 'ZH',
    distance: 'far',
    sttCode: 'zh',
    bcp47: 'zh-CN',
    rtl: false,
    wiktionary: 'zh',
    freeDictionary: false,
    teachingNotes:
      'Watch for tone, measure words, and aspect markers. Write in simplified characters, not pinyin.',
    voiceSample: '你好！我是你的老师。我们开始聊天吧？',
  },
  {
    code: 'ru',
    nativeName: 'Русский',
    name: { en: 'Russian', pt: 'Russo' },
    badge: 'RU',
    distance: 'far',
    sttCode: 'ru',
    bcp47: 'ru-RU',
    rtl: false,
    wiktionary: 'ru',
    freeDictionary: false,
    teachingNotes:
      'Watch for case endings, verb aspect, and the absence of articles. Write in Cyrillic.',
    voiceSample: 'Привет! Я твой преподаватель. Начнём разговор?',
  },
]

const BY_CODE = new Map(LANGUAGES.map((language) => [language.code, language]))

export const LANGUAGE_CODES = LANGUAGES.map((language) => language.code) as [
  LanguageCode,
  ...LanguageCode[],
]

export const DEFAULT_LANGUAGE: LanguageCode = 'en'

export const isLanguageCode = (value: unknown): value is LanguageCode =>
  typeof value === 'string' && BY_CODE.has(value as LanguageCode)

/** Never throws: an unknown code falls back to English rather than a blank page. */
export function getLanguage(code: string | null | undefined): Language {
  return BY_CODE.get(code as LanguageCode) ?? BY_CODE.get(DEFAULT_LANGUAGE)!
}

/**
 * Whether a workspace in this language should open with the interface in
 * Portuguese. Learning kana while also decoding an English menu is two
 * problems where there should be one.
 */
export const suggestsNativeInterface = (code: string) => getLanguage(code).distance === 'far'

/** How many languages one account may practise at once. */
export const MAX_WORKSPACES = 3
