import { cn, pct } from '@/lib/utils'

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'brand' | 'amber' | 'rose' | 'iris'
  className?: string
}) {
  const tones = {
    neutral: 'bg-surface-2 text-muted border-line',
    brand: 'bg-brand-500/10 text-brand-700 border-brand-500/20 dark:text-brand-300',
    amber: 'bg-amber/12 text-amber border-amber/25',
    rose: 'bg-rose/10 text-rose border-rose/20',
    iris: 'bg-iris/10 text-iris border-iris/20',
  }[tone]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[0.6875rem] font-semibold tracking-wide',
        tones,
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Progress({
  value,
  total,
  className,
  tone = 'brand',
  label,
}: {
  value: number
  total: number
  className?: string
  tone?: 'brand' | 'amber' | 'iris'
  label?: string
}) {
  const percent = pct(value, total)
  const bar = { brand: 'bg-brand-500', amber: 'bg-amber', iris: 'bg-iris' }[tone]

  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-pill bg-surface-2', className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={label}
    >
      <div
        className={cn('h-full rounded-pill transition-[width] duration-700 ease-out', bar)}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

export function Stat({
  label,
  value,
  suffix,
  icon,
  className,
}: {
  label: string
  value: React.ReactNode
  suffix?: string
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-faint">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="display text-2xl text-ink sm:text-[1.75rem]">{value}</span>
        {suffix && <span className="text-xs font-medium text-muted">{suffix}</span>}
      </div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-card border border-dashed border-line px-6 py-14 text-center',
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-surface-2 text-muted">
          {icon}
        </div>
      )}
      <h3 className="text-[0.9375rem] font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[0.8125rem] leading-relaxed text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-lg bg-linear-to-r from-surface-2 via-line to-surface-2 bg-[length:200%_100%] animate-shimmer',
        className,
      )}
    />
  )
}

/** Score dial used across the session report. */
export function ScoreRing({
  score,
  label,
  size = 88,
}: {
  score: number
  label: string
  size?: number
}) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100)
  const tone = score >= 80 ? 'var(--brand-500)' : score >= 60 ? 'var(--amber)' : 'var(--rose)'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--surface-2)"
            strokeWidth="6"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={tone}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center display text-xl text-ink">
          {score}
        </span>
      </div>
      <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
    </div>
  )
}
