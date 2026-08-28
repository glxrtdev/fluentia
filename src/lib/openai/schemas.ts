/**
 * The JSON schemas the model must answer with.
 *
 * Pure data, deliberately outside the server-only prompt module: a schema is
 * not a secret and not a server capability, and keeping it importable means
 * the conversion to Gemini's dialect can be tested against the real thing
 * instead of a copy that quietly drifts.
 */

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
              'One short sentence explaining why, in simple Brazilian Portuguese, so the learner can read it beside the conversation.',
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
