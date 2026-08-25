import { redirect } from 'next/navigation'

import { MobileChrome } from '@/components/shell/mobile-nav'
import { Sidebar } from '@/components/shell/sidebar'
import { signOut } from '@/lib/auth/actions'
import { getProfile, getSettings, requireUser } from '@/lib/auth/session'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const [profile, settings] = await Promise.all([getProfile(user.id), getSettings(user.id)])

  if (!profile.onboardedAt) redirect('/onboarding')

  const shellUser = {
    name: user.name,
    email: user.email,
    xp: profile.xp,
    streak: profile.streakCurrent,
    theme: settings.theme,
  }

  return (
    <div className="flex min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-pill focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-canvas"
      >
        Skip to content
      </a>

      <Sidebar user={shellUser} signOut={signOut} />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileChrome user={shellUser} signOut={signOut} />
        <main id="main" data-app-main className="min-w-0 flex-1 pb-24 lg:pb-0">
          {children}
        </main>
      </div>
    </div>
  )
}
