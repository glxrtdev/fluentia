import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { getActiveWorkspace, getCurrentUser, getProfile } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { getLanguage } from '@/lib/languages'
import { vocabulary } from '@/lib/db/schema'
import { getAiClient, toAiError } from '@/lib/ai'
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
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const limit = rateLimit(`translate:${user.id}`, 40, 60_000)
  if (!limit.ok) return Response.json({ error: 'Traduções demais.' }, { status: 429 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Requisição inválida.' }, { status: 400 })

  const profile = await getProfile(user.id)
  const language = LANGUAGE_NAMES[profile.nativeLanguage]
  if (!language) {
    return Response.json(
      { error: 'Defina um idioma nativo nas Configurações para usar traduções.' },
      { status: 400 },
    )
  }

  // The word belongs to whichever language the open workspace practises.
  const workspace = await getActiveWorkspace(user.id)
  const sourceLanguage = getLanguage(workspace?.language)

  try {
    const ai = await getAiClient(user.id)
    const translation = await ai.chatText({
      system: `Translate ${sourceLanguage.name.en} vocabulary into ${language} for a language learner. Reply with the translation only: at most four words, no quotes, no explanation, nothing else.`,
      user: `${sourceLanguage.name.en} word: ${parsed.data.word}
Definition (in English): ${parsed.data.definition}`,
      temperature: 0.2,
      maxTokens: 120,
    })

    const clean = translation.trim().slice(0, 200)
    if (!clean) return Response.json({ error: 'Nenhuma tradução voltou.' }, { status: 502 })

    // Persist it when the word is already in the learner's own vocabulary.
    if (parsed.data.vocabularyId) {
      await db
        .update(vocabulary)
        .set({ translation: clean, updatedAt: new Date() })
        .where(
          and(eq(vocabulary.id, parsed.data.vocabularyId), eq(vocabulary.userId, user.id)),
        )
    }

    return Response.json({ translation: clean, language })
  } catch (error) {
    const aiError = toAiError(error)
    return Response.json({ error: aiError.message }, { status: aiError.status })
  }
}
