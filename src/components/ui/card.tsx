import { cn } from '@/lib/utils'

export function Card({
  className,
  as: Tag = 'div',
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: React.ElementType }) {
  return (
    <Tag
      className={cn(
        'rounded-card border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({
  title,
  hint,
  action,
  className,
}: {
  title: React.ReactNode
  hint?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-[0.9375rem] font-semibold text-ink">{title}</h2>
        {hint && <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

export function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <h2
      className={cn(
        'text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-faint',
        className,
      )}
    >
      {children}
    </h2>
  )
}
