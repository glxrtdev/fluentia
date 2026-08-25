'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Flame, LogOut, MoreHorizontal, X } from 'lucide-react'

import { Logo } from '@/components/brand/logo'
import { ThemeToggle } from '@/components/shell/theme-toggle'
import { NAV } from '@/components/shell/nav'
import { cn, formatNumber, initials } from '@/lib/utils'

export type ShellUser = {
  name: string
  email: string
  xp: number
  streak: number
  theme: string
}

/**
 * The four destinations that earn a permanent slot on a phone, plus everything
 * else behind one more tap.
 *
 * Five equal tabs did not fit 320px — and worse, half the app had no way in
 * from a phone at all. A sheet keeps the bar readable and the app complete.
 */
const PRIMARY = ['/dashboard', '/speak', '/mistakes', '/vocabulary']
const SECONDARY = ['/sessions', '/profile', '/goals', '/achievements', '/settings']

const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`)

export function MobileChrome({
  user,
  signOut,
}: {
  user: ShellUser
  signOut: () => Promise<void>
}) {
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)

  const primary = PRIMARY.map((href) => NAV.find((item) => item.href === href)!)
  const secondary = SECONDARY.map((href) => NAV.find((item) => item.href === href)!)
  const sheetHasActive = secondary.some((item) => isActive(pathname, item.href))

  // A route change must never leave the sheet covering the page it opened.
  useEffect(() => setSheetOpen(false), [pathname])

  // The page behind a sheet should not scroll under the thumb.
  useEffect(() => {
    if (!sheetOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [sheetOpen])

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-canvas/85 px-4 py-2.5 backdrop-blur-md lg:hidden">
        <Logo href="/dashboard" />
        <div className="flex items-center gap-1">
          <span className="inline-flex h-9 items-center gap-1 px-1 text-[0.8125rem] font-semibold text-brand-600 dark:text-brand-400">
            <Flame className="size-3.5" />
            {user.streak}
          </span>
          <ThemeToggle initial={user.theme} />
        </div>
      </header>

      <nav
        data-mobile-nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        {primary.map((item) => {
          const active = isActive(pathname, item.href)
          const primaryAction = item.href === '/speak'

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 text-[0.6875rem] font-medium"
            >
              <span
                className={cn(
                  'flex items-center justify-center rounded-full transition-colors',
                  primaryAction
                    ? 'size-9 bg-brand-500 text-white'
                    : cn('size-6', active ? 'text-brand-600 dark:text-brand-400' : 'text-faint'),
                )}
              >
                <item.icon className={primaryAction ? 'size-4' : 'size-[1.15rem]'} />
              </span>
              <span className={cn('w-full truncate text-center', active ? 'text-ink' : 'text-faint')}>
                {item.short}
              </span>
            </Link>
          )
        })}

        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-expanded={sheetOpen}
          aria-label="More sections"
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 text-[0.6875rem] font-medium"
        >
          <span
            className={cn(
              'flex size-6 items-center justify-center rounded-full transition-colors',
              sheetHasActive ? 'text-brand-600 dark:text-brand-400' : 'text-faint',
            )}
          >
            <MoreHorizontal className="size-[1.15rem]" />
          </span>
          <span className={cn('w-full truncate text-center', sheetHasActive ? 'text-ink' : 'text-faint')}>
            More
          </span>
        </button>
      </nav>

      {sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in"
          />

          <div className="absolute inset-x-0 bottom-0 animate-fade-up rounded-t-card border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-500/12 text-[0.6875rem] font-bold text-brand-600 dark:text-brand-400">
                  {initials(user.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.875rem] font-medium text-ink">{user.name}</p>
                  <p className="truncate text-xs text-muted">{formatNumber(user.xp)} XP</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
                className="flex size-10 items-center justify-center rounded-control text-muted"
              >
                <X className="size-4" />
              </button>
            </div>

            <ul className="p-2">
              {secondary.map((item) => {
                const active = isActive(pathname, item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-control px-3 py-3 text-[0.9375rem]',
                        active ? 'bg-surface-2 font-medium text-ink' : 'text-ink-soft',
                      )}
                    >
                      <item.icon
                        className={cn(
                          'size-[1.15rem] shrink-0',
                          active ? 'text-brand-600 dark:text-brand-400' : 'text-faint',
                        )}
                      />
                      {item.label}
                    </Link>
                  </li>
                )
              })}

              <li className="mt-1 border-t border-line pt-1">
                <form action={signOut}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-3 rounded-control px-3 py-3 text-[0.9375rem] text-muted"
                  >
                    <LogOut className="size-[1.15rem] shrink-0 text-faint" />
                    Log out
                  </button>
                </form>
              </li>
            </ul>
          </div>
        </div>
      )}
    </>
  )
}
