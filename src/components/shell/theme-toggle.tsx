'use client'

import { useEffect, useState, useTransition } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'

import { setTheme as persistTheme } from '@/lib/actions/ai'
import { cn } from '@/lib/utils'

type Theme = 'system' | 'light' | 'dark'
const ORDER: Theme[] = ['system', 'light', 'dark']
const ICONS = { system: Monitor, light: Sun, dark: Moon }

function apply(theme: Theme) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  // A year-long cookie so the server can render the right theme on first paint.
  document.cookie = `fluentia_theme=${theme}; path=/; max-age=31536000; samesite=lax`
}

export function ThemeToggle({ initial = 'system' }: { initial?: string }) {
  const [theme, setTheme] = useState<Theme>((initial as Theme) ?? 'system')
  const [, startTransition] = useTransition()

  // Keep "system" live if the OS preference changes while the tab is open.
  useEffect(() => {
    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  const next = () => {
    const value = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]
    setTheme(value)
    apply(value)
    // Remember it server-side too, so a new device starts on the right theme.
    startTransition(() => void persistTheme(value))
  }

  const Icon = ICONS[theme]

  return (
    <button
      type="button"
      onClick={next}
      title={`Theme: ${theme}`}
      aria-label={`Theme: ${theme}. Click to change.`}
      className={cn(
        'flex size-9 items-center justify-center rounded-control text-faint transition-colors hover:bg-surface-2 hover:text-ink',
      )}
    >
      <Icon className="size-4" />
    </button>
  )
}
