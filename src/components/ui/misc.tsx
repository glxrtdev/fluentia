import { cn, pct } from '@/lib/utils'

/**
 * Three tones only. Colour carries meaning: `accent` is progress and identity,
 * `danger` is a mistake, everything else stays greyscale.
 */
export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'accent' | 'danger'
  className?: string
}) {
  const tones = {
    neutral: 'bg-surface-2 text-muted border-line',
    accent: 'bg-brand-500/10 text-brand-600 border-brand-500/20 dark:text-brand-400',
    danger: 'bg-rose/10 text-rose border-rose/20',
  }[tone]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill border px-2 py-0.5 text-[0.6875rem] font-medium tracking-[-0.01em]',
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
  tone = 'accent',
  label,
}: {
  value: number
  total: number
  className?: string
  tone?: 'accent' | 'neutral'
  label?: string
}) {
  const percent = pct(value, total)

  return (
    <div
      className={cn('h-1 w-full overflow-hidden rounded-pill bg-surface-2', className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={label}
    >
      <div
        className={cn(
          'h-full rounded-pill transition-[width] duration-700 ease-out',
          tone === 'accent' ? 'bg-brand-500' : 'bg-line-strong',
        )}
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
      <div className="flex items-center gap-1.5 text-[0.75rem] font-medium text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="display text-[1.75rem] leading-none text-ink">{value}</span>
        {suffix && <span className="text-[0.8125rem] text-faint">{suffix}</span>}
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
        <div className="mb-4 flex size-9 items-center justify-center rounded-control bg-surface-2 text-faint">
          {icon}
        </div>
      )}
      <h3 className="text-[0.9375rem] font-medium text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[0.8125rem] leading-relaxed text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-control bg-linear-to-r from-surface-2 via-line to-surface-2 bg-[length:200%_100%] animate-shimmer',
        className,
      )}
    />
  )
}

/**
 * Score dial. The ring is always the accent — the number says how well it went,
 * so the colour does not need to repeat it.
 */
export function ScoreRing({
  score,
  label,
  size = 84,
}: {
  score: number
  label: string
  size?: number
}) {
  const radius = (size - 6) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100)

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--surface-2)"
            strokeWidth="3"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--brand-500)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center display text-[1.375rem] text-ink">
          {score}
        </span>
      </div>
      <span className="text-[0.75rem] font-medium text-muted">{label}</span>
    </div>
  )
}
