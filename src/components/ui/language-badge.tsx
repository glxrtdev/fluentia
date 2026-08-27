import { cn } from '@/lib/utils'

/**
 * The two-letter mark that stands for a language.
 *
 * Drawn rather than borrowed from the emoji set: Windows has no glyphs for
 * regional-indicator pairs, so flags rendered as bare letters in a mismatched
 * font. A flag is also the wrong symbol — Spanish is not Spain, and English is
 * not one island.
 */
export function LanguageBadge({
  code,
  size = 'md',
  className,
}: {
  code: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg font-semibold tracking-tight',
        'bg-brand-500/12 text-brand-600 dark:text-brand-400',
        size === 'sm' && 'size-6 text-[0.625rem]',
        size === 'md' && 'size-8 text-[0.6875rem]',
        size === 'lg' && 'size-10 text-[0.8125rem]',
        className,
      )}
    >
      {code}
    </span>
  )
}
