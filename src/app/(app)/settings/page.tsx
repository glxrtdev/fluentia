import type { Metadata } from 'next'
import { ShieldCheck } from 'lucide-react'

import { PageHeader, PageShell } from '@/components/shell/page-header'
import { AiPreferences } from '@/components/settings/ai-preferences'
import { ApiKeyPanel } from '@/components/settings/api-key-panel'
import { LearningPreferences } from '@/components/settings/learning-preferences'
import { PasswordPanel } from '@/components/settings/password-panel'
import { Card } from '@/components/ui/card'
import { getProfile, getSettings, requireUser } from '@/lib/auth/session'
import { DEFAULT_MODELS } from '@/lib/openai/client'
import { loadModelOptions } from '@/lib/openai/models'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const user = await requireUser()
  const [profile, settings] = await Promise.all([getProfile(user.id), getSettings(user.id)])

  // Offered from the recommended set plus whatever this account can reach.
  const models = await loadModelOptions(user.id, DEFAULT_MODELS)

  return (
    <PageShell>
      <PageHeader
        eyebrow="Settings"
        title="AI configuration"
        description="Your key, your models, your data. Fluentia stores conversations in its own database on this server and never shares them with another account."
      />

      <div className="mt-8 space-y-6">
        <ApiKeyPanel
          hint={settings.openaiKeyHint}
          status={settings.openaiKeyStatus}
          verifiedAt={settings.openaiKeyVerifiedAt}
        />

        <AiPreferences
          models={models}
          current={{
            chatModel: settings.chatModel,
            sttModel: settings.sttModel,
            ttsModel: settings.ttsModel,
            voice: settings.voice,
          }}
        />

        <LearningPreferences
          name={user.name}
          profile={{
            level: profile.level,
            autoAdaptLevel: profile.autoAdaptLevel,
            mainGoal: profile.mainGoal,
            dailyMinutesGoal: profile.dailyMinutesGoal,
            nativeLanguage: profile.nativeLanguage,
            interests: profile.interests,
          }}
        />

        <PasswordPanel />

        <Card className="bg-surface-2">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-400" />
            <div className="text-[0.8125rem] leading-relaxed text-muted">
              <p className="font-semibold text-ink">How your data is handled</p>
              <ul className="mt-2 space-y-1.5">
                <li>
                  Your API key is encrypted at rest and decrypted only inside the server request
                  that calls OpenAI.
                </li>
                <li>
                  Audio is streamed to OpenAI for transcription and speech; Fluentia keeps the text,
                  not the recordings.
                </li>
                <li>
                  Every query in the app is scoped to your user id — conversations, mistakes and
                  vocabulary are yours alone.
                </li>
                <li>Signed-in sessions are opaque tokens stored hashed, valid for 30 days.</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </PageShell>
  )
}
