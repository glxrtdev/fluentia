import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { getCurrentUser, getProfile } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { vocabulary } from '@/lib/db/schema'
import { getUserAi, toAiError } from '@/lib/openai/client'
import { rateLimit } from '@/lib/rate-limit'

const LANGUAGE_NAMES: Record<string, string> = {
  'pt-BR': 'Brazilian Portuguese',
  'pt-PT': 'European Portuguese',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
}

const bodySchema = z.object({
  word: z.string().trim().min(1).max(80),
  definition: z.string().trim().min(1).max(600),
  vocabularyId: z.string().trim().max(64).nullable().optional(),
})

/**
 * Translates one word into the learner's own language, on request only — it
 * spends the learner's OpenAI credit, so it is never done automatically.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const limit = rateLimit(`translate:${user.id}`, 40, 60_000)
  if (!limit.ok) return Response.json({ error: 'Too many translations.' }, { status: 429 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid request.' }, { status: 400 })

  const profile = await getProfile(user.id)
  const language = LANGUAGE_NAMES[profile.nativeLanguage]
  if (!language) {
    return Response.json(
      { error: 'Set a native language in Settings to use translations.' },
      { status: 400 },
    )
  }

  try {
    const ai = getUserAi(user.id)
    const completion = await ai.client.chat.completions.create({
      model: ai.models.chat,
      temperature: 0.2,
      max_tokens: 120,
      messages: [
        {
          role: 'system',
          content: `Translate English vocabulary into ${language} for a language learner. Reply with the translation only: at most four words, no quotes, no explanation, no English.`,
        },
        {
          role: 'user',
          content: `Word: ${parsed.data.word}\nEnglish definition: ${parsed.data.definition}`,
        },
      ],
    })

    const translation = (completion.choices[0]?.message?.content ?? '').trim().slice(0, 200)
    if (!translation) return Response.json({ error: 'No translation came back.' }, { status: 502 })

    // Persist it when the word is already in the learner's own vocabulary.
    if (parsed.data.vocabularyId) {
      db.update(vocabulary)
        .set({ translation, updatedAt: new Date() })
        .where(
          and(eq(vocabulary.id, parsed.data.vocabularyId), eq(vocabulary.userId, user.id)),
        )
        .run()
    }

    return Response.json({ translation, language })
  } catch (error) {
    const aiError = toAiError(error)
    return Response.json({ error: aiError.message }, { status: aiError.status })
  }
}
