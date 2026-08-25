'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Flame, LogOut, Plus } from 'lucide-react'

import { Logo } from '@/components/brand/logo'
import { ThemeToggle } from '@/components/shell/theme-toggle'
import { GROUP_LABELS, NAV, type NavItem } from '@/components/shell/nav'
import { cn, formatNumber, initials } from '@/lib/utils'

import type { ShellUser } from '@/components/shell/mobile-nav'

const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`)

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href)
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex items-center gap-2.5 rounded-xl px-3 py-2 text-[0.8125rem] font-medium transition-colors',
        active ? 'bg-surface-2 text-ink' : 'text-muted hover:bg-surface-2/60 hover:text-ink',
      )}
    >
      <item.icon
        className={cn(
          'size-4 shrink-0 transition-colors',
          active ? 'text-brand-600 dark:text-brand-400' : 'text-faint group-hover:text-muted',
        )}
      />
      {item.label}
    </Link>
  )
}

export function Sidebar({ user, signOut }: { user: ShellUser; signOut: () => Promise<void> }) {
  const pathname = usePathname()
  const groups = ['practice', 'learning', 'progress'] as const

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-canvas-soft px-4 py-5 lg:flex">
      <Logo href="/dashboard" className="px-1" />

      <Link
        href="/speak"
        className="mt-5 flex h-10 items-center justify-center gap-2 rounded-control bg-brand-500 text-[0.875rem] font-medium text-white transition-colors hover:bg-brand-600 active:scale-[0.985]"
      >
        <Plus className="size-4" />
        New conversation
      </Link>

      <nav className="mt-7 flex-1 space-y-6 overflow-y-auto scroll-slim">
        {groups.map((group) => (
          <div key={group}>
            <p className="px-3 pb-2 text-[0.75rem] font-medium text-faint">
              {GROUP_LABELS[group]}
            </p>
            <div className="space-y-0.5">
              {NAV.filter((item) => item.group === group).map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-4 space-y-3 border-t border-line pt-4">
        <div className="flex items-center justify-between px-1">
          <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-brand-600 dark:text-brand-400">
            <Flame className="size-3.5" />
            {user.streak}
            <span className="font-medium text-muted">day streak</span>
          </span>
          <ThemeToggle initial={user.theme} />
        </div>

        <div className="flex items-center gap-2.5 rounded-xl px-1 py-1">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-500/12 text-[0.6875rem] font-bold text-brand-600 dark:text-brand-400">
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.8125rem] font-semibold text-ink">{user.name}</p>
            <p className="truncate text-[0.6875rem] text-muted">
              {formatNumber(user.xp)} XP
            </p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Log out"
              className="flex size-9 items-center justify-center rounded-control text-faint transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
