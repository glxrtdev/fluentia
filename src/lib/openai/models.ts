import 'server-only'

import type { SelectOption } from '@/components/ui/select'

import { getAiClient, PROVIDERS, type AiClient, type ProviderId } from '@/lib/ai'

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
type Recommendation = { id: string; label: string; description: string }

const OPENAI_RECOMMENDED: Record<ModelRole, Recommendation[]> =
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

const GEMINI_RECOMMENDED: Record<ModelRole, Recommendation[]> = {
  chat: [
    {
      id: 'gemini-2.5-flash',
      label: 'Gemini 2.5 Flash',
      description: 'Equilibrado. O padrão — conversa natural e correções confiáveis.',
    },
    {
      id: 'gemini-2.5-pro',
      label: 'Gemini 2.5 Pro',
      description: 'Mais capaz e mais caro. Correções mais precisas em nível avançado.',
    },
    {
      id: 'gemini-2.5-flash-lite',
      label: 'Gemini 2.5 Flash Lite',
      description: 'O mais barato e rápido. Correções menos precisas.',
    },
  ],
  stt: [
    {
      id: 'gemini-2.5-flash',
      label: 'Gemini 2.5 Flash',
      description: 'Transcreve o áudio direto. Bom com fala hesitante.',
    },
    {
      id: 'gemini-2.5-flash-lite',
      label: 'Gemini 2.5 Flash Lite',
      description: 'Mais barato para transcrever, um pouco menos exato.',
    },
  ],
  tts: [
    {
      id: 'gemini-2.5-flash-preview-tts',
      label: 'Gemini 2.5 Flash TTS',
      description: 'Vozes pré-definidas do Gemini. Responde em uma peça, não em stream.',
    },
    {
      id: 'gemini-2.5-pro-preview-tts',
      label: 'Gemini 2.5 Pro TTS',
      description: 'Entrega mais expressiva, mais cara.',
    },
  ],
}

const RECOMMENDED: Record<ProviderId, Record<ModelRole, Recommendation[]>> = {
  openai: OPENAI_RECOMMENDED,
  gemini: GEMINI_RECOMMENDED,
}

/**
 * Which ids belong to which role, for filtering the account's own catalogue.
 *
 * Gemini names one model for several jobs — `gemini-2.5-flash` both hears and
 * thinks — so its rule is by suffix, not by family.
 */
function roleOf(id: string, provider: ProviderId): ModelRole | null {
  if (provider === 'gemini') {
    if (!id.startsWith('gemini')) return null
    if (/-tts$/.test(id)) return 'tts'
    if (/embedding|image|imagen|veo|live|native-audio/.test(id)) return null
    // A text model can transcribe as well as reply, so it is offered for both.
    return 'chat'
  }

  if (/tts/.test(id)) return 'tts'
  if (/transcribe|whisper/.test(id)) return 'stt'
  if (/^(gpt-|o[1-9])/.test(id) && !/audio|realtime|image|search|embedding|moderation/.test(id)) {
    return 'chat'
  }
  return null
}

function optionsFor(
  role: ModelRole,
  defaultId: string,
  available: string[],
  provider: ProviderId,
): SelectOption[] {
  const recommended = RECOMMENDED[provider][role]

  const base: SelectOption[] = [
    {
      value: '',
      label: `Padrão (${defaultId})`,
      description: 'Segue o padrão do app, que pode mudar numa atualização.',
      group: 'Recomendados',
    },
    ...recommended.map((model) => ({
      value: model.id,
      label: model.label,
      description: model.description,
      group: 'Recomendados',
    })),
  ]

  const known = new Set(recommended.map((model) => model.id))
  const extra = available
    .filter((id) => {
      const belongs = roleOf(id, provider)
      // Gemini text models double as transcribers, so they appear under both.
      const fits = provider === 'gemini' && role === 'stt' ? belongs === 'chat' : belongs === role
      return fits && !known.has(id)
    })
    .sort()
    .map((id) => ({ value: id, label: id, group: 'Também disponíveis na sua conta' }))

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
  provider: ProviderId,
): Promise<Record<ModelRole, SelectOption[]>> {
  const defaults = PROVIDERS[provider].defaults
  let available: string[] = []

  // Keyed by provider too: switching providers must not serve the old catalogue.
  const cacheKey = `${userId}:${provider}`
  const cached = catalogueCache.get(cacheKey)
  if (cached && cached.expires > Date.now()) {
    available = cached.ids
  } else {
    try {
      const ai: AiClient = await getAiClient(userId)
      available = await ai.listModels()
      catalogueCache.set(cacheKey, { expires: Date.now() + CATALOGUE_TTL_MS, ids: available })
    } catch {
      available = []
    }
  }

  return {
    chat: optionsFor('chat', defaults.chat, available, provider),
    stt: optionsFor('stt', defaults.stt, available, provider),
    tts: optionsFor('tts', defaults.tts, available, provider),
  }
}
