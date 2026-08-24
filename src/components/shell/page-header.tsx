import { cn } from '@/lib/utils'

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <header
      className={cn('flex flex-wrap items-end justify-between gap-4', className)}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2.5 text-[0.75rem] font-medium text-brand-600 dark:text-brand-400">
            {eyebrow}
          </p>
        )}
        <h1 className="display text-[1.75rem] leading-[1.1] text-ink sm:text-[2.125rem]">{title}</h1>
        {description && (
          <p className="mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">{description}</p>
        )}
      </div>
      {action}
    </header>
  )
}

/** Standard page container: generous margins, capped width, mobile-safe. */
export function PageShell({
  children,
  className,
  width = 'default',
}: {
  children: React.ReactNode
  className?: string
  width?: 'default' | 'wide' | 'narrow'
}) {
  const max = {
    narrow: 'max-w-2xl',
    default: 'max-w-5xl',
    wide: 'max-w-6xl',
  }[width]

  return (
    <div className={cn('mx-auto w-full px-5 py-8 sm:px-8 sm:py-10', max, className)}>{children}</div>
  )
}
