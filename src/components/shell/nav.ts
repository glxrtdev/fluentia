import {
  BookMarked,
  Flag,
  Gauge,
  History,
  Mic,
  Settings,
  SpellCheck,
  Trophy,
  UserRound,
} from 'lucide-react'

export type NavItem = {
  href: string
  label: string
  /** Fits a fifth of a 320px screen; the sidebar keeps the long name. */
  short: string
  icon: typeof Gauge
  group: 'practice' | 'learning' | 'progress'
}

export const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', short: 'Home', icon: Gauge, group: 'practice' },
  { href: '/speak', label: 'Speaking', short: 'Speak', icon: Mic, group: 'practice' },
  { href: '/sessions', label: 'My sessions', short: 'Sessions', icon: History, group: 'practice' },
  { href: '/mistakes', label: 'My mistakes', short: 'Mistakes', icon: SpellCheck, group: 'learning' },
  { href: '/vocabulary', label: 'Vocabulary', short: 'Words', icon: BookMarked, group: 'learning' },
  { href: '/profile', label: 'English profile', short: 'Profile', icon: UserRound, group: 'learning' },
  { href: '/goals', label: 'Goals', short: 'Goals', icon: Flag, group: 'progress' },
  { href: '/achievements', label: 'Achievements', short: 'Awards', icon: Trophy, group: 'progress' },
  { href: '/settings', label: 'Settings', short: 'Settings', icon: Settings, group: 'progress' },
]

export const GROUP_LABELS: Record<NavItem['group'], string> = {
  practice: 'Practice',
  learning: 'Learning',
  progress: 'Progress',
}

