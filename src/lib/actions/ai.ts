'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { encryptSecret } from '@/lib/crypto'
import { db } from '@/lib/db'
import { userSettings } from '@/lib/db/schema'
import {
  getAiClient,
  isProviderId,
  keyHint,
  PROVIDERS,
  toAiError,
  type ProviderId,
} from '@/lib/ai'
import { rateLimit } from '@/lib/rate-limit'
import { aiPreferencesSchema, apiKeySchema, fieldErrors } from '@/lib/validation'

export type AiSettingsState =
  | { ok?: boolean; message?: string; errors?: Record<string, string> }
  | undefined

/** The cheapest call that proves a key works. */
async function probe(userId: string) {
  const ai = await getAiClient(userId)
  await ai.verify()
}

/**
 * Column names per provider.
 *
 * Keys live in their own columns rather than one shared slot so that switching
 * provider and back does not throw away a key the learner already pasted.
 */
const COLUMNS = {
  openai: {
    cipher: 'openaiKeyCipher',
    hint: 'openaiKeyHint',
    status: 'openaiKeyStatus',
    verifiedAt: 'openaiKeyVerifiedAt',
  },
  gemini: {
    cipher: 'geminiKeyCipher',
    hint: 'geminiKeyHint',
    status: 'geminiKeyStatus',
    verifiedAt: 'geminiKeyVerifiedAt',
  },
} as const

const keyFields = (provider: ProviderId, values: Record<string, unknown>) => {
  const columns = COLUMNS[provider]
  const out: Record<string, unknown> = {}
  for (const [role, value] of Object.entries(values)) {
    out[columns[role as keyof typeof columns]] = value
  }
  return out
}

/** Which provider a settings write is about. Defaults to the one in use. */
async function providerFor(userId: string, requested: unknown): Promise<ProviderId> {
  if (isProviderId(requested)) return requested
  const [row] = await db
    .select({ provider: userSettings.aiProvider })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1)
  return isProviderId(row?.provider) ? row.provider : 'openai'
}

/** Switches which provider runs the conversation. */
export async function setAiProvider(value: string): Promise<AiSettingsState> {
  const user = await requireUser()
  if (!isProviderId(value)) return { errors: { form: 'Provedor desconhecido.' } }

  await db
    .insert(userSettings)
    .values({ userId: user.id, aiProvider: value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userSettings.userId,
      /*
       * The saved models belong to the old provider, so they are cleared
       * rather than carried across — `gpt-4o` sent to Gemini is a confusing
       * 404. The voice is cleared for the same reason; each provider names
       * its own.
       */
      set: {
        aiProvider: value,
        chatModel: null,
        sttModel: null,
        ttsModel: null,
        voice: PROVIDERS[value].voices[0].id,
        updatedAt: new Date(),
      },
    })

  revalidatePath('/settings')
  return { ok: true, message: `Agora usando ${PROVIDERS[value].label}.` }
}

export async function saveApiKey(
  _prev: AiSettingsState,
  formData: FormData,
): Promise<AiSettingsState> {
  const user = await requireUser()

  const parsed = apiKeySchema.safeParse({ apiKey: formData.get('apiKey') })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const provider = await providerFor(user.id, formData.get('provider'))
  const apiKey = parsed.data.apiKey

  /*
   * Catch a key pasted into the wrong provider here rather than letting the
   * request fail later with a message about an invalid key — the mistake is
   * easy to make and the shapes are unmistakable.
   */
  if (!PROVIDERS[provider].keyPattern.test(apiKey)) {
    return {
      errors: {
        apiKey: `Isso não parece uma chave da ${PROVIDERS[provider].label}. ${keyHint(PROVIDERS[provider])}`,
      },
    }
  }

  const written = keyFields(provider, {
    cipher: encryptSecret(apiKey),
    hint: apiKey.slice(-4),
    status: 'unset',
    verifiedAt: null,
  })

  await db
    .insert(userSettings)
    .values({ userId: user.id, aiProvider: provider, ...written, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { aiProvider: provider, ...written, updatedAt: new Date() },
    })

  // Verify immediately so the user never leaves this page unsure.
  try {
    await probe(user.id)
    await db
      .update(userSettings)
      .set(keyFields(provider, { status: 'ok', verifiedAt: new Date() }))
      .where(eq(userSettings.userId, user.id))
    revalidatePath('/settings')
    return { ok: true, message: 'Chave salva e verificada.' }
  } catch (error) {
    await db
      .update(userSettings)
      .set(keyFields(provider, { status: 'invalid', verifiedAt: null }))
      .where(eq(userSettings.userId, user.id))
    revalidatePath('/settings')
    return { errors: { apiKey: toAiError(error).message } }
  }
}

export async function testApiKey(): Promise<AiSettingsState> {
  const user = await requireUser()
  const provider = await providerFor(user.id, null)

  const limit = rateLimit(`ai-test:${user.id}`, 10, 60_000)
  if (!limit.ok) return { errors: { form: 'Espere um instante antes de testar de novo.' } }

  try {
    await probe(user.id)
    await db
      .update(userSettings)
      .set(keyFields(provider, { status: 'ok', verifiedAt: new Date() }))
      .where(eq(userSettings.userId, user.id))
    revalidatePath('/settings')
    return { ok: true, message: 'Conexão saudável.' }
  } catch (error) {
    const aiError = toAiError(error)
    if (aiError.status === 401) {
      await db
        .update(userSettings)
        .set(keyFields(provider, { status: 'invalid' }))
        .where(eq(userSettings.userId, user.id))
    }
    revalidatePath('/settings')
    return { errors: { form: aiError.message } }
  }
}

export async function removeApiKey(providerValue?: string): Promise<AiSettingsState> {
  const user = await requireUser()
  const provider = await providerFor(user.id, providerValue)

  await db
    .update(userSettings)
    .set({
      ...keyFields(provider, { cipher: null, hint: null, status: 'unset', verifiedAt: null }),
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
