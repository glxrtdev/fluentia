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
  { href: '/dashboard', label: 'Painel', short: 'Início', icon: Gauge, group: 'practice' },
  { href: '/speak', label: 'Conversar', short: 'Falar', icon: Mic, group: 'practice' },
  { href: '/sessions', label: 'Minhas sessões', short: 'Sessões', icon: History, group: 'practice' },
  { href: '/mistakes', label: 'Meus erros', short: 'Erros', icon: SpellCheck, group: 'learning' },
  { href: '/vocabulary', label: 'Vocabulário', short: 'Palavras', icon: BookMarked, group: 'learning' },
  // No longer "English profile": the profile describes whichever language the
  // space is for.
  { href: '/profile', label: 'Perfil de idioma', short: 'Perfil', icon: UserRound, group: 'learning' },
  { href: '/goals', label: 'Metas', short: 'Metas', icon: Flag, group: 'progress' },
  { href: '/achievements', label: 'Conquistas', short: 'Prêmios', icon: Trophy, group: 'progress' },
  { href: '/settings', label: 'Configurações', short: 'Ajustes', icon: Settings, group: 'progress' },
]

export const GROUP_LABELS: Record<NavItem['group'], string> = {
  practice: 'Prática',
  learning: 'Aprendizado',
  progress: 'Progresso',
}

