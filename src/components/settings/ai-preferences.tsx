'use client'

import { useActionState } from 'react'
import { CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Select, type SelectOption } from '@/components/ui/select'
import { VoicePicker } from '@/components/settings/voice-picker'
import { updateAiPreferences } from '@/lib/actions/ai'

export function AiPreferences({
  models,
  current,
}: {
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
        title="Models and voice"
        hint="Every model here is billed to your own OpenAI account. Cheaper ones cost less per session and usually correct less accurately."
      />

      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Conversation"
            error={state?.errors?.chatModel}
            hint="Writes the teacher's replies and finds your mistakes."
          >
            <Select name="chatModel" options={models.chat} defaultValue={current.chatModel ?? ''} />
          </Field>

          <Field
            label="Transcription"
            error={state?.errors?.sttModel}
            hint="Turns what you say into text."
          >
            <Select name="sttModel" options={models.stt} defaultValue={current.sttModel ?? ''} />
          </Field>

          <Field
            label="Speech"
            error={state?.errors?.ttsModel}
            hint="Gives the teacher a voice."
          >
            <Select name="ttsModel" options={models.tts} defaultValue={current.ttsModel ?? ''} />
          </Field>

          <Field
            label="Teacher voice"
            error={state?.errors?.voice}
            className="sm:col-span-2"
          >
            <VoicePicker defaultValue={current.voice} />
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
          Save preferences
        </Button>
      </form>
    </Card>
  )
}
