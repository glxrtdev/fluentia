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
  icon: typeof Gauge
  group: 'practice' | 'learning' | 'progress'
}

export const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Gauge, group: 'practice' },
  { href: '/speak', label: 'Speaking', icon: Mic, group: 'practice' },
  { href: '/sessions', label: 'My sessions', icon: History, group: 'practice' },
  { href: '/mistakes', label: 'My mistakes', icon: SpellCheck, group: 'learning' },
  { href: '/vocabulary', label: 'Vocabulary', icon: BookMarked, group: 'learning' },
  { href: '/profile', label: 'English profile', icon: UserRound, group: 'learning' },
  { href: '/goals', label: 'Goals', icon: Flag, group: 'progress' },
  { href: '/achievements', label: 'Achievements', icon: Trophy, group: 'progress' },
  { href: '/settings', label: 'Settings', icon: Settings, group: 'progress' },
]

export const GROUP_LABELS: Record<NavItem['group'], string> = {
  practice: 'Practice',
  learning: 'Learning',
  progress: 'Progress',
}

/** The five destinations that fit a phone's bottom bar. */
export const MOBILE_NAV = ['/dashboard', '/speak', '/mistakes', '/vocabulary', '/settings']
