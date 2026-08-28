'use client'

import { useActionState } from 'react'
import { CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Select, type SelectOption } from '@/components/ui/select'
import { VoicePicker } from '@/components/settings/voice-picker'
import type { ProviderId } from '@/lib/ai/provider'
import { updateAiPreferences } from '@/lib/actions/ai'

export function AiPreferences({
  provider,
  models,
  current,
}: {
  provider: ProviderId
  models: { chat: SelectOption[]; stt: SelectOption[]; tts: SelectOption[] }
  current: {
    chatModel: string | null
    sttModel: string | null
    ttsModel: string | null
    voice: string
  }
}) {
  const [state, formAction, pending] = useActionState(updateAiPreferences, undefined)

  return (
    <Card>
      <CardHeader
        title="Modelos e voz"
        hint="Every model here is billed to your own OpenAI account. Cheaper ones cost less per session and usually correct less accurately."
      />

      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Conversa"
            error={state?.errors?.chatModel}
            hint="Escreve as respostas do professor e encontra seus erros."
          >
            <Select name="chatModel" options={models.chat} defaultValue={current.chatModel ?? ''} />
          </Field>

          <Field
            label="Transcrição"
            error={state?.errors?.sttModel}
            hint="Transforma o que você fala em texto."
          >
            <Select name="sttModel" options={models.stt} defaultValue={current.sttModel ?? ''} />
          </Field>

          <Field
            label="Fala"
            error={state?.errors?.ttsModel}
            hint="Dá voz ao professor."
          >
            <Select name="ttsModel" options={models.tts} defaultValue={current.ttsModel ?? ''} />
          </Field>

          <Field
            label="Voz do professor"
            error={state?.errors?.voice}
            className="sm:col-span-2"
          >
            <VoicePicker defaultValue={current.voice} provider={provider} />
          </Field>
        </div>

        {state?.errors?.form && (
          <p role="alert" className="text-[0.8125rem] font-medium text-rose">
            {state.errors.form}
          </p>
        )}

        {state?.ok && state.message && (
          <p className="flex items-center gap-2 text-[0.8125rem] font-medium text-brand-600 dark:text-brand-400">
            <CheckCircle2 className="size-4" />
            {state.message}
          </p>
        )}

        <Button type="submit" variant="secondary" loading={pending}>
          Salvar preferências
        </Button>
      </form>
    </Card>
  )
}
