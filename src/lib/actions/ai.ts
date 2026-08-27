'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { encryptSecret } from '@/lib/crypto'
import { db } from '@/lib/db'
import { userSettings } from '@/lib/db/schema'
import { getUserAi, toAiError } from '@/lib/openai/client'
import { rateLimit } from '@/lib/rate-limit'
import { aiPreferencesSchema, apiKeySchema, fieldErrors } from '@/lib/validation'

export type AiSettingsState =
  | { ok?: boolean; message?: string; errors?: Record<string, string> }
  | undefined

/** Lists models with the given key — the cheapest way to prove it works. */
async function probe(userId: string) {
  const ai = await getUserAi(userId)
  await ai.client.models.list()
}

export async function saveApiKey(
  _prev: AiSettingsState,
  formData: FormData,
): Promise<AiSettingsState> {
  const user = await requireUser()

  const parsed = apiKeySchema.safeParse({ apiKey: formData.get('apiKey') })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const apiKey = parsed.data.apiKey
  await db
    .insert(userSettings)
    .values({
      userId: user.id,
      openaiKeyCipher: encryptSecret(apiKey),
      openaiKeyHint: apiKey.slice(-4),
      openaiKeyStatus: 'unset',
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        openaiKeyCipher: encryptSecret(apiKey),
        openaiKeyHint: apiKey.slice(-4),
        openaiKeyStatus: 'unset',
        openaiKeyVerifiedAt: null,
        updatedAt: new Date(),
      },
    })

  // Verify immediately so the user never leaves this page unsure.
  try {
    await probe(user.id)
    await db
      .update(userSettings)
      .set({ openaiKeyStatus: 'ok', openaiKeyVerifiedAt: new Date() })
      .where(eq(userSettings.userId, user.id))
    revalidatePath('/settings')
    return { ok: true, message: 'Chave salva e verificada.' }
  } catch (error) {
    await db
      .update(userSettings)
      .set({ openaiKeyStatus: 'invalid', openaiKeyVerifiedAt: null })
      .where(eq(userSettings.userId, user.id))
    revalidatePath('/settings')
    return { errors: { apiKey: toAiError(error).message } }
  }
}

export async function testApiKey(): Promise<AiSettingsState> {
  const user = await requireUser()

  const limit = rateLimit(`ai-test:${user.id}`, 10, 60_000)
  if (!limit.ok) return { errors: { form: 'Espere um instante antes de testar de novo.' } }

  try {
    await probe(user.id)
    await db
      .update(userSettings)
      .set({ openaiKeyStatus: 'ok', openaiKeyVerifiedAt: new Date() })
      .where(eq(userSettings.userId, user.id))
    revalidatePath('/settings')
    return { ok: true, message: 'Conexão saudável.' }
  } catch (error) {
    const aiError = toAiError(error)
    if (aiError.status === 401) {
      await db
        .update(userSettings)
        .set({ openaiKeyStatus: 'invalid' })
        .where(eq(userSettings.userId, user.id))
    }
    revalidatePath('/settings')
    return { errors: { form: aiError.message } }
  }
}

export async function removeApiKey(): Promise<AiSettingsState> {
  const user = await requireUser()

  await db
    .update(userSettings)
    .set({
      openaiKeyCipher: null,
      openaiKeyHint: null,
      openaiKeyStatus: 'unset',
      openaiKeyVerifiedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, user.id))

  revalidatePath('/settings')
  return { ok: true, message: 'Chave removida.' }
}

export async function updateAiPreferences(
  _prev: AiSettingsState,
  formData: FormData,
): Promise<AiSettingsState> {
  const user = await requireUser()

  const parsed = aiPreferencesSchema.safeParse({
    chatModel: (formData.get('chatModel') as string)?.trim() || null,
    sttModel: (formData.get('sttModel') as string)?.trim() || null,
    ttsModel: (formData.get('ttsModel') as string)?.trim() || null,
    voice: formData.get('voice'),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  await db
    .update(userSettings)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(userSettings.userId, user.id))

  revalidatePath('/settings')
  return { ok: true, message: 'Preferências salvas.' }
}

export async function setTheme(theme: 'system' | 'light' | 'dark') {
  const user = await requireUser()
  await db
    .update(userSettings)
    .set({ theme, updatedAt: new Date() })
    .where(eq(userSettings.userId, user.id))
}
