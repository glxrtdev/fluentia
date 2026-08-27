import type { Metadata } from 'next'
import { ShieldCheck } from 'lucide-react'

import { PageHeader, PageShell } from '@/components/shell/page-header'
import { AiPreferences } from '@/components/settings/ai-preferences'
import { ApiKeyPanel } from '@/components/settings/api-key-panel'
import { LearningPreferences } from '@/components/settings/learning-preferences'
import { PasswordPanel } from '@/components/settings/password-panel'
import { WorkspacePanel } from '@/components/settings/workspace-panel'
import { Card } from '@/components/ui/card'
import { getProfile, getSettings, requireUser, requireWorkspace } from '@/lib/auth/session'
import { listWorkspaces, MAX_WORKSPACES } from '@/lib/domain/workspace'
import { DEFAULT_MODELS } from '@/lib/openai/client'
import { loadModelOptions } from '@/lib/openai/models'
import { db } from '@/lib/db'
import { conversations, vocabulary } from '@/lib/db/schema'
import { and, eq, sql as raw } from 'drizzle-orm'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const user = await requireUser()
  const [profile, settings, workspace] = await Promise.all([
    getProfile(user.id),
    getSettings(user.id),
    requireWorkspace(user.id),
  ])

  // Offered from the recommended set plus whatever this account can reach.
  const [models, workspaces, counts] = await Promise.all([
    loadModelOptions(user.id, DEFAULT_MODELS),
    listWorkspaces(user.id),
    // How much lives in each space, so removing one is an informed decision.
    db
      .select({
        workspaceId: conversations.workspaceId,
        sessions: raw<number>`count(*)::int`,
      })
      .from(conversations)
      .where(and(eq(conversations.userId, user.id), eq(conversations.status, 'completed')))
      .groupBy(conversations.workspaceId),
  ])

  const words = await db
    .select({ workspaceId: vocabulary.workspaceId, words: raw<number>`count(*)::int` })
    .from(vocabulary)
    .where(eq(vocabulary.userId, user.id))
    .groupBy(vocabulary.workspaceId)

  const sessionsBy = new Map(counts.map((row) => [row.workspaceId, row.sessions]))
  const wordsBy = new Map(words.map((row) => [row.workspaceId, row.words]))

  const spaces = workspaces.map((entry) => ({
    id: entry.id,
    language: entry.language,
    sessions: sessionsBy.get(entry.id) ?? 0,
    words: wordsBy.get(entry.id) ?? 0,
  }))

  return (
    <PageShell>
      <PageHeader
        eyebrow="Configurações"
        title="Configuração de IA"
        description="Sua chave, seus modelos, seus dados. A Fluentia guarda as conversas no próprio banco deste servidor e nunca compartilha com outra conta."
      />

      <div className="mt-8 space-y-6">
        <ApiKeyPanel
          hint={settings.openaiKeyHint}
          status={settings.openaiKeyStatus}
          verifiedAt={settings.openaiKeyVerifiedAt}
        />

        <WorkspacePanel
          spaces={spaces}
          activeId={workspace.id}
          canAdd={workspaces.length < MAX_WORKSPACES}
          max={MAX_WORKSPACES}
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
            level: workspace.level,
            autoAdaptLevel: workspace.autoAdaptLevel,
            mainGoal: workspace.mainGoal,
            dailyMinutesGoal: workspace.dailyMinutesGoal,
            nativeLanguage: profile.nativeLanguage,
            interests: workspace.interests,
          }}
        />

        <PasswordPanel />

        <Card className="bg-surface-2">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-400" />
            <div className="text-[0.8125rem] leading-relaxed text-muted">
              <p className="font-semibold text-ink">Como seus dados são tratados</p>
              <ul className="mt-2 space-y-1.5">
                <li>
                  Sua chave da API é criptografada em repouso e descriptografada apenas dentro da
                  requisição de servidor que chama a OpenAI.
                </li>
                <li>
                  O áudio é enviado à OpenAI para transcrição e fala; a Fluentia guarda o texto,
                  não as gravações.
                </li>
                <li>
                  Toda consulta do app é limitada ao seu id de usuário — conversas, erros e
                  vocabulário são só seus.
                </li>
                <li>As sessões conectadas são tokens opacos, guardados com hash e válidos por 30 dias.</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </PageShell>
  )
}
