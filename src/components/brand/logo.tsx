import { cn } from '@/lib/utils'

/**
 * The Fluentia mark: five rounded bars rising and falling like a voice
 * waveform, wrapped in a squircle. It doubles as the "listening" indicator.
 */
export function LogoMark({
  className,
  animated = false,
}: {
  className?: string
  animated?: boolean
}) {
  const bars = [
    { x: 6, h: 8 },
    { x: 11, h: 16 },
    { x: 16, h: 24 },
    { x: 21, h: 14 },
    { x: 26, h: 7 },
  ]

  return (
    <span
      className={cn(
        'relative inline-flex size-9 shrink-0 items-center justify-center rounded-[0.7rem] bg-linear-to-br from-brand-400 to-brand-700 text-white shadow-sm',
        className,
      )}
    >
      <svg viewBox="0 0 36 36" className="size-full" aria-hidden="true">
        {bars.map((bar, i) => (
          <rect
            key={bar.x}
            x={bar.x}
            y={18 - bar.h / 2}
            width="3.4"
            height={bar.h}
            rx="1.7"
            fill="currentColor"
            opacity={0.55 + i * 0.09}
            style={
              animated
                ? { animation: `bar 1.1s ease-in-out ${i * 0.12}s infinite`, transformOrigin: 'center' }
                : undefined
            }
          />
        ))}
      </svg>
    </span>
  )
}

export function Logo({
  className,
  showWordmark = true,
  href,
}: {
  className?: string
  showWordmark?: boolean
  href?: string
}) {
  const content = (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      {showWordmark && (
        <span className="display text-[1.35rem] leading-none tracking-tight text-ink">
          Fluentia
        </span>
      )}
    </span>
  )

  if (!href) return content
  return (
    <a href={href} className="inline-flex rounded-lg" aria-label="Fluentia home">
      {content}
    </a>
  )
}
