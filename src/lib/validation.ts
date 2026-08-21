import { z } from 'zod'

import {
  CORRECTION_CATEGORIES,
  ENGLISH_LEVELS,
  GOAL_KINDS,
  MAIN_GOALS,
} from '@/lib/db/schema'

export const emailSchema = z
  .string()
  .trim()
  .max(254)
  .pipe(z.email('Enter a valid email address.'))
  .transform((v) => v.toLowerCase())

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(200, 'That password is too long.')

export const signUpSchema = z.object({
  name: z.string().trim().min(2, 'Tell us your name.').max(60),
  email: emailSchema,
  password: passwordSchema,
})

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
})

export const levelSchema = z.enum(ENGLISH_LEVELS)
export const correctionCategorySchema = z.enum(CORRECTION_CATEGORIES)

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(60),
  level: levelSchema,
  autoAdaptLevel: z.boolean(),
  mainGoal: z.enum(MAIN_GOALS).nullable(),
  dailyMinutesGoal: z.union([z.literal(10), z.literal(20), z.literal(30), z.literal(60)]),
  nativeLanguage: z.string().trim().min(2).max(10),
  interests: z.array(z.string().trim().min(1).max(40)).max(12),
})

export const goalsSchema = z.object({
  goals: z
    .array(z.object({ kind: z.enum(GOAL_KINDS), target: z.number().int().min(0).max(1000) }))
    .max(GOAL_KINDS.length),
})

export const apiKeySchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(20, 'That does not look like an OpenAI key.')
    .max(200)
    .regex(/^sk-[A-Za-z0-9_\-]+$/, 'OpenAI keys start with "sk-".'),
})

export const aiPreferencesSchema = z.object({
  chatModel: z.string().trim().max(60).nullable(),
  sttModel: z.string().trim().max(60).nullable(),
  ttsModel: z.string().trim().max(60).nullable(),
  voice: z.enum(['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse']),
})

export const startConversationSchema = z.object({
  topicId: z.string().trim().max(60).nullable().optional(),
  customBrief: z.string().trim().min(3).max(300).nullable().optional(),
  level: levelSchema.optional(),
})

export const endConversationSchema = z.object({
  durationSeconds: z.number().int().min(0).max(4 * 3600),
})

export const dictionaryQuerySchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[a-zA-Z][a-zA-Z '\-]*$/, 'Search a single English word.')

export const addVocabularySchema = z.object({
  word: z.string().trim().min(1).max(60),
  partOfSpeech: z.string().trim().max(40).nullable().optional(),
  phonetic: z.string().trim().max(80).nullable().optional(),
  definition: z.string().trim().min(1).max(600),
  example: z.string().trim().max(400).nullable().optional(),
  translation: z.string().trim().max(200).nullable().optional(),
  audioUrl: z.string().trim().url().max(500).nullable().optional(),
  related: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  source: z.enum(['dictionary', 'conversation']).optional(),
})

export const vocabularyStatusSchema = z.object({
  status: z.enum(['learning', 'learned', 'review']),
})

export const mistakeStatusSchema = z.object({
  status: z.enum(['open', 'improving', 'resolved']),
})

/** Turns a ZodError into `{ field: message }` for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form'
    out[key] ??= issue.message
  }
  return out
}
