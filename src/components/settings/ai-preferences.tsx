'use client'

import { useActionState } from 'react'
import { CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { updateAiPreferences } from '@/lib/actions/ai'

const VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse']

export function AiPreferences({
  defaults,
  current,
}: {
  defaults: { chat: string; stt: string; tts: string }
  current: { chatModel: string | null; sttModel: string | null; ttsModel: string | null; voice: string }
}) {
  const [state, formAction, pending] = useActionState(updateAiPreferences, undefined)

  return (
    <Card>
      <CardHeader
        title="Models and voice"
        hint="Leave a field empty to use the default. Cheaper models cost less per session but usually correct less accurately."
      />

      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Conversation model" error={state?.errors?.chatModel}>
            <Input
              name="chatModel"
              defaultValue={current.chatModel ?? ''}
              placeholder={defaults.chat}
              spellCheck={false}
              className="font-mono text-[0.8125rem]"
            />
          </Field>

          <Field label="Transcription model" error={state?.errors?.sttModel}>
            <Input
              name="sttModel"
              defaultValue={current.sttModel ?? ''}
              placeholder={defaults.stt}
              spellCheck={false}
              className="font-mono text-[0.8125rem]"
            />
          </Field>

          <Field label="Speech model" error={state?.errors?.ttsModel}>
            <Input
              name="ttsModel"
              defaultValue={current.ttsModel ?? ''}
              placeholder={defaults.tts}
              spellCheck={false}
              className="font-mono text-[0.8125rem]"
            />
          </Field>

          <Field label="Teacher voice" error={state?.errors?.voice}>
            <Select name="voice" defaultValue={current.voice}>
              {VOICES.map((voice) => (
                <option key={voice} value={voice}>
                  {voice}
                </option>
              ))}
            </Select>
          </Field>
        </div>

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
