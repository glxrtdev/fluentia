import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

/** 4h 32m / 12m / 45s */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0m'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m > 0) return `${m}m`
  return `${Math.round(seconds)}s`
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value)

export function formatDate(value: Date | number | string) {
  return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(value),
  )
}

export function formatRelative(value: Date | number | string) {
  const then = new Date(value).getTime()
  const diff = Date.now() - then
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 1000],
    ['minute', 60_000],
    ['hour', 3_600_000],
    ['day', 86_400_000],
    ['week', 604_800_000],
    ['month', 2_629_800_000],
    ['year', 31_557_600_000],
  ]
  const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' })
  let chosen = units[0]
  for (const unit of units) if (Math.abs(diff) >= unit[1]) chosen = unit
  return rtf.format(-Math.round(diff / chosen[1]), chosen[0])
}

export const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  elementary: 'Elementary',
  intermediate: 'Intermediate',
  'upper-intermediate': 'Upper Intermediate',
  advanced: 'Advanced',
}

export const CATEGORY_LABELS: Record<string, string> = {
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
  prepositions: 'Prepositions',
  pronunciation: 'Pronunciation',
  'sentence-structure': 'Sentence structure',
  naturalness: 'Naturalness',
}

/**
 * Calendar day as YYYY-MM-DD in the viewer's timezone. `tzOffsetMinutes` comes
 * from the browser (`new Date().getTimezoneOffset()`) so a streak flips at the
 * user's midnight, not the server's.
 */
export function localDay(
  date: Date = new Date(),
  tzOffsetMinutes: number = date.getTimezoneOffset(),
): string {
  return new Date(date.getTime() - tzOffsetMinutes * 60_000).toISOString().slice(0, 10)
}

export const addDays = (day: string, delta: number) => {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + delta))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
    date.getUTCDate(),
  ).padStart(2, '0')}`
}

export const daysBetween = (from: string, to: string) => {
  const parse = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((parse(to) - parse(from)) / 86_400_000)
}

/** Monday-based start of the ISO week containing `day`. */
export function startOfWeek(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const weekday = (date.getUTCDay() + 6) % 7
  return addDays(day, -weekday)
}

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export const pct = (value: number, total: number) =>
  total <= 0 ? 0 : clamp(Math.round((value / total) * 100), 0, 100)

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

/** Resolves the caller's calendar day from a client-supplied timezone offset. */
export function dayFrom(tzOffset: unknown): string {
  const value = Number(tzOffset)
  return localDay(new Date(), Number.isFinite(value) ? value : undefined)
}
