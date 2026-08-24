import 'server-only'

import type { SelectOption } from '@/components/ui/select'

import { getUserAi, type UserAi } from './client'

export type ModelRole = 'chat' | 'stt' | 'tts'

/*
 * OpenAI's catalogue barely moves, and asking for it costs a second on every
 * settings visit. Half an hour in process is plenty; a new model shows up on
 * the next server restart or after the window.
 */
const CATALOGUE_TTL_MS = 30 * 60_000
const catalogueCache = new Map<string, { expires: number; ids: string[] }>()

/**
 * Models worth recommending, with the trade-off spelled out. Nobody should have
 * to remember an OpenAI model id to use this app.
 *
 * The list is a starting point, not a boundary: `loadModelOptions` also offers
 * whatever else the learner's own account can reach, so a newer model works
 * here the day they get access to it.
 */
export const RECOMMENDED: Record<ModelRole, { id: string; label: string; description: string }[]> =
  {
    chat: [
      {
        id: 'gpt-4o',
        label: 'GPT-4o',
        description: 'Balanced. The default — natural conversation and reliable corrections.',
      },
      {
        id: 'gpt-4o-mini',
        label: 'GPT-4o mini',
        description: 'Cheapest and fastest. Corrections are less precise.',
      },
      {
        id: 'gpt-4.1',
        label: 'GPT-4.1',
        description: 'Sharper reasoning. Costs more per session.',
      },
      {
        id: 'gpt-4.1-mini',
        label: 'GPT-4.1 mini',
        description: 'Most of 4.1 for a fraction of the price.',
      },
    ],
    stt: [
      {
        id: 'gpt-4o-transcribe',
        label: 'GPT-4o transcribe',
        description: 'Most accurate with accents and hesitation. The default.',
      },
      {
        id: 'gpt-4o-mini-transcribe',
        label: 'GPT-4o mini transcribe',
        description: 'Cheaper, slightly less accurate.',
      },
      {
        id: 'whisper-1',
        label: 'Whisper',
        description: 'The classic model. Cheapest, and weaker on hesitant speech.',
      },
    ],
    tts: [
      {
        id: 'gpt-4o-mini-tts',
        label: 'GPT-4o mini TTS',
        description: 'Warmest voice, and the only one that follows tone instructions.',
      },
      { id: 'tts-1', label: 'TTS-1', description: 'Fastest to start speaking. Flatter delivery.' },
      { id: 'tts-1-hd', label: 'TTS-1 HD', description: 'Higher fidelity, slower and pricier.' },
    ],
  }

/** Which ids belong to which role, for filtering the account's own catalogue. */
function roleOf(id: string): ModelRole | null {
  if (/tts/.test(id)) return 'tts'
  if (/transcribe|whisper/.test(id)) return 'stt'
  if (/^(gpt-|o[1-9])/.test(id) && !/audio|realtime|image|search|embedding|moderation/.test(id)) {
    return 'chat'
  }
  return null
}

function optionsFor(role: ModelRole, defaultId: string, available: string[]): SelectOption[] {
  const recommended = RECOMMENDED[role]

  const base: SelectOption[] = [
    {
      value: '',
      label: `Default (${defaultId})`,
      description: 'Follow the app default, which may change with an update.',
      group: 'Recommended',
    },
    ...recommended.map((model) => ({
      value: model.id,
      label: model.label,
      description: model.description,
      group: 'Recommended',
    })),
  ]

  const known = new Set(recommended.map((model) => model.id))
  const extra = available
    .filter((id) => roleOf(id) === role && !known.has(id))
    .sort()
    .map((id) => ({ value: id, label: id, group: 'Also available to your account' }))

  return [...base, ...extra]
}

/**
 * Pickers for all three roles: the recommended models first, then anything else
 * the account can actually reach.
 *
 * OpenAI is asked for its catalogue once and the three roles are filtered out
 * of that single answer — the settings page should not pay for three identical
 * network calls. Falls back to the recommendations alone when the key is
 * missing or OpenAI is unreachable, so the picker still works offline.
 */
export async function loadModelOptions(
  userId: string,
  defaults: Record<ModelRole, string>,
): Promise<Record<ModelRole, SelectOption[]>> {
  let available: string[] = []

  const cached = catalogueCache.get(userId)
  if (cached && cached.expires > Date.now()) {
    available = cached.ids
  } else {
    try {
      const ai: UserAi = await getUserAi(userId)
      const page = await ai.client.models.list()
      available = page.data.map((model) => model.id)
      catalogueCache.set(userId, { expires: Date.now() + CATALOGUE_TTL_MS, ids: available })
    } catch {
      available = []
    }
  }

  return {
    chat: optionsFor('chat', defaults.chat, available),
    stt: optionsFor('stt', defaults.stt, available),
    tts: optionsFor('tts', defaults.tts, available),
  }
}
