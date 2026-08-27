import { redirect } from 'next/navigation'

import { MobileChrome } from '@/components/shell/mobile-nav'
import { Sidebar } from '@/components/shell/sidebar'
import { signOut } from '@/lib/auth/actions'
import { getProfile, getSettings, requireUser, requireWorkspace } from '@/lib/auth/session'
import { listWorkspaces, MAX_WORKSPACES } from '@/lib/domain/workspace'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const [profile, settings] = await Promise.all([getProfile(user.id), getSettings(user.id)])

  if (!profile.onboardedAt) redirect('/onboarding')

  const [workspace, workspaces] = await Promise.all([
    requireWorkspace(user.id),
    listWorkspaces(user.id),
  ])

  const shellUser = {
    name: user.name,
    email: user.email,
    xp: profile.xp,
    streak: profile.streakCurrent,
    theme: settings.theme,
  }

  // Only what the switcher needs: the shell has no business holding a
  // learner's strengths and weaknesses.
  const spaces = workspaces.map((entry) => ({
    id: entry.id,
    language: entry.language,
    level: entry.level,
  }))
  const canAddWorkspace = workspaces.length < MAX_WORKSPACES

  return (
    <div className="flex min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-pill focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-canvas"
      >
        Pular para o conteúdo
      </a>

      <Sidebar
        user={shellUser}
        workspaces={spaces}
        activeWorkspaceId={workspace.id}
        canAddWorkspace={canAddWorkspace}
        signOut={signOut}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileChrome
          user={shellUser}
          workspaces={spaces}
          activeWorkspaceId={workspace.id}
          canAddWorkspace={canAddWorkspace}
          signOut={signOut}
        />
        <main id="main" data-app-main className="min-w-0 flex-1 pb-24 lg:pb-0">
          {children}
        </main>
      </div>
    </div>
  )
}
