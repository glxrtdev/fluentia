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
      className={cn('flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6', className)}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-faint">
            {eyebrow}
          </p>
        )}
        <h1 className="display text-[2rem] leading-tight text-ink sm:text-[2.35rem]">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">{description}</p>
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
