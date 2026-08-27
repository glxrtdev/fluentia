import 'server-only'

import type { Level } from '@/lib/db/schema'
import { getLanguage, type LanguageCode } from '@/lib/languages'
import { LEVEL_LABELS } from '@/lib/utils'

export type TeacherContext = {
  learnerName: string
  /** The language being practised. Everything below adapts to it. */
  language: LanguageCode | string
  level: Level
  topicLabel: string
  topicBrief: string
  mainGoal: string | null
  interests: string[]
  /** Recurring mistakes, most frequent first, to weave in without drilling. */
  focusMistakes: { original: string; corrected: string; category: string; occurrences: number }[]
  /** Words the learner is studying, so the teacher can reuse them naturally. */
  activeVocabulary: string[]
}

const LEVEL_GUIDANCE: Record<Level, string> = {
  beginner:
    'Use very short sentences, the simplest tense the language has, and the 500 most common words. One question at a time. Speak slowly and warmly. Never use idioms.',
  elementary:
    'Use simple sentences and common vocabulary, in the two or three most basic tenses. Rephrase instead of explaining grammar. One question at a time.',
  intermediate:
    'Speak naturally at a moderate pace. Mix tenses. Introduce a slightly more precise word now and then, and use it in context so it is guessable.',
  'upper-intermediate':
    'Speak at a natural pace with real collocations and phrasal verbs. Ask follow-ups that require opinions, comparisons and hypotheticals.',
  advanced:
    'Speak as you would to a fluent adult: idiomatic, nuanced, fast. Challenge vague answers, ask for precision, disagree sometimes.',
}

/**
 * The teacher persona. Two rules matter most: it must never read corrections
 * out loud, and it must sound like a person, not a grammar checker.
 */
export function buildTeacherPrompt(ctx: TeacherContext): string {
  const focus = ctx.focusMistakes
    .slice(0, 6)
    .map((m) => `- "${m.original}" should be "${m.corrected}" (${m.category}, ${m.occurrences}x)`)
    .join('\n')

  const language = getLanguage(ctx.language)

  return `You are the ${language.name.en} teacher inside Fluentia, having a live spoken conversation with ${ctx.learnerName}.

## The language
You teach ${language.name.en} (${language.nativeName}) and you speak it with ${ctx.learnerName} the entire time.
- Every word of your spoken reply is in ${language.name.en}. Never switch to English or to the learner's own language, not even to explain something.
- Write ${language.nativeName} in its own script and orthography. Never transliterate it into the Latin alphabet unless that is how the language is normally written.
- ${language.teachingNotes}

## Conversation
Topic: ${ctx.topicLabel}
Brief: ${ctx.topicBrief}
Learner level: ${LEVEL_LABELS[ctx.level]}
${ctx.mainGoal ? `Learner's main goal: ${ctx.mainGoal}` : ''}
${ctx.interests.length ? `Interests you may use for examples: ${ctx.interests.join(', ')}` : ''}

## How to speak
${LEVEL_GUIDANCE[ctx.level]}
- You are talking, not writing. 1 to 3 sentences per turn, then a question.
- Never use markdown, bullet points, emoji, stage directions or asterisks. Plain spoken words only.
- React to what was actually said before asking the next thing. Show you listened.
- Keep the learner talking: they should speak far more than you.
- If the learner goes silent or says almost nothing, offer an easier, more concrete question.
- If the learner asks a question about the language, answer it briefly, still in ${language.name.en}, and move on.

## Corrections — critical
The learner sees your corrections on screen while you keep talking.
- NEVER say a correction out loud. Your spoken reply must not mention grammar, mistakes or the words "correct" or "should be".
- Put corrections only in the "corrections" field.
- At most 3 corrections per turn, and only the ones that matter: mistakes that break meaning, that repeat, or that would sound wrong to a native speaker. Ignore typos in the transcript, filler words, self-corrections and regional variation.
- If the learner spoke well, return an empty corrections array. Not every turn needs a correction.
- Quote only the words that are wrong. "original" and "corrected" must be the shortest pair that shows the mistake — usually two to six words. Never quote a whole sentence on both sides just to change part of it, and never repeat words that are identical on both sides.
- One correction per distinct mistake. If a sentence has two unrelated problems, that is two corrections, not one rewrite of the sentence.
- The full rewritten sentence belongs in "better_sentence" and nowhere else.
- If a correction touches one of the recurring mistakes below, always include it — those are the ones the learner is working on.
${focus ? `\n### Recurring mistakes to watch for\n${focus}\n\nWhen it fits the conversation, steer towards situations that require these forms. Do it invisibly, through what you ask — never announce it and never turn the conversation into an exercise.` : ''}
${ctx.activeVocabulary.length ? `\n### Words the learner is studying\n${ctx.activeVocabulary.slice(0, 20).join(', ')}\nUse a few of them naturally where they fit.` : ''}

## Written feedback
The explanations, and only the explanations, are written in English. Everything the learner hears is in ${language.name.en}.

## Level signal
Report whether your last turn seemed too easy, about right, or too hard for this learner, based on their fluency, vocabulary range and hesitation.`
}

/** JSON Schema for a conversation turn. Kept strict so parsing never fails. */
export const TURN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'corrections', 'level_signal'],
  properties: {
    reply: {
      type: 'string',
      description:
        'What the teacher says out loud, in the language being taught. Spoken language only, no corrections.',
    },
    corrections: {
      type: 'array',
      description: 'Up to 3 corrections for what the learner just said. May be empty.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['category', 'original', 'corrected', 'explanation', 'better_sentence', 'severity'],
        properties: {
          category: {
            type: 'string',
            enum: [
              'grammar',
              'vocabulary',
              'prepositions',
              'pronunciation',
              'sentence-structure',
              'naturalness',
            ],
          },
          original: {
            type: 'string',
            description:
              'Only the wrong words, exactly as the learner said them. The shortest quote that shows the mistake, usually 2-6 words. Never a whole sentence.',
          },
          corrected: {
            type: 'string',
            description:
              'The same short span, fixed. Must not repeat words that were already correct in "original".',
          },
          explanation: {
            type: 'string',
            description:
              'One short sentence explaining why, written in simple English so the learner can read it beside the conversation.',
          },
          better_sentence: {
            type: 'string',
            description:
              'The learner full sentence rewritten naturally, or an empty string if not useful.',
          },
          severity: {
            type: 'integer',
            description: '1 = minor, 2 = worth noting, 3 = breaks meaning or repeats often.',
            enum: [1, 2, 3],
          },
        },
      },
    },
    level_signal: {
      type: 'string',
      enum: ['too_easy', 'right', 'too_hard'],
    },
  },
} as const

/** JSON Schema for the end-of-session report. */
export const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'speaking',
    'grammar',
    'vocabulary',
    'fluency',
    'pronunciation',
    'summary',
    'main_mistakes',
    'new_words',
    'expressions',
    'recommendations',
    'strengths',
    'weaknesses',
  ],
  properties: {
    speaking: { type: 'integer', description: 'Overall speaking score 0-100.' },
    grammar: { type: 'integer' },
    vocabulary: { type: 'integer' },
    fluency: { type: 'integer' },
    pronunciation: {
      type: ['integer', 'null'],
      description:
        'Only score this if the transcript shows real pronunciation evidence; otherwise null.',
    },
    summary: {
      type: 'string',
      description: 'Two or three sentences addressed to the learner, specific to this conversation.',
    },
    main_mistakes: {
      type: 'array',
      description: 'The 1-4 patterns worth working on, most important first.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'detail'],
        properties: {
          label: { type: 'string', description: 'Short name, e.g. "Past tense".' },
          detail: { type: 'string', description: 'One sentence with an example from the session.' },
        },
      },
    },
    new_words: {
      type: 'array',
      description: 'Useful words that came up and are worth saving. Up to 6.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['word', 'meaning'],
        properties: {
          word: { type: 'string' },
          meaning: { type: 'string' },
        },
      },
    },
    expressions: {
      type: 'array',
      description: 'Natural expressions or collocations to reuse. Up to 6.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['expression', 'meaning'],
        properties: {
          expression: { type: 'string' },
          meaning: { type: 'string' },
        },
      },
    },
    recommendations: {
      type: 'array',
      description: 'Two or three concrete suggestions for the next session.',
      items: { type: 'string' },
    },
    strengths: {
      type: 'array',
      description: 'Two or three areas this learner handles well, as short labels.',
      items: { type: 'string' },
    },
    weaknesses: {
      type: 'array',
      description: 'Two or three areas to improve, as short labels.',
      items: { type: 'string' },
    },
  },
} as const

export function buildReportPrompt(ctx: {
  learnerName: string
  language: LanguageCode | string
  level: Level
  topicLabel: string
  durationSeconds: number
  correctionCount: number
}) {
  const language = getLanguage(ctx.language)

  return `You are assessing a spoken ${language.name.en} session in Fluentia.

Learner: ${ctx.learnerName}
Declared level: ${LEVEL_LABELS[ctx.level]}
Topic: ${ctx.topicLabel}
Duration: ${Math.round(ctx.durationSeconds / 60)} minutes
Corrections raised live: ${ctx.correctionCount}

You will receive the transcript. Only the learner's turns are evidence — judge them, not the teacher's.

Rules:
- Be honest but encouraging. Scores are 0-100 and should reflect this session, not a fantasy.
- A short session with little speech gets modest confidence: keep scores near the declared level rather than inventing extremes.
- Pronunciation cannot be judged from text. Return null unless the transcript itself shows clear evidence (for example the learner mentioning a sound they struggled with, or a mis-transcription that reveals a pronunciation problem).
- "new_words" and "expressions" must actually appear in the conversation.
- Write the summary directly to the learner, in the second person, in Portuguese — it is read, not heard.
- Do not guess a CEFR level. Fluentia derives it from the speaking score you give, so the two can never disagree.`
}
