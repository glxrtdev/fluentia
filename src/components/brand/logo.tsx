import { cn } from '@/lib/utils'

/**
 * The Fluentia mark: five bars rising and falling like a voice waveform, set in
 * a solid accent squircle. Flat and monochrome on purpose — a gradient would be
 * the only decorative colour in the whole interface.
 */
export function LogoMark({
  className,
  animated = false,
}: {
  className?: string
  animated?: boolean
}) {
  const bars = [
    { x: 7.5, h: 7 },
    { x: 12.2, h: 14 },
    { x: 16.9, h: 22 },
    { x: 21.6, h: 12 },
    { x: 26.3, h: 6 },
  ]

  return (
    <span
      className={cn(
        'relative inline-flex size-8 shrink-0 items-center justify-center rounded-[0.6rem] bg-brand-500 text-white',
        className,
      )}
    >
      <svg viewBox="0 0 36 36" className="size-full" aria-hidden="true">
        {bars.map((bar, i) => (
          <rect
            key={bar.x}
            x={bar.x}
            y={18 - bar.h / 2}
            width="2.6"
            height={bar.h}
            rx="1.3"
            fill="currentColor"
            opacity={i === 2 ? 1 : 0.72}
            style={
              animated
                ? {
                    animation: `bar 1.1s ease-in-out ${i * 0.12}s infinite`,
                    transformOrigin: 'center',
                  }
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
        <span className="text-[1.0625rem] font-semibold tracking-[-0.03em] text-ink">Fluentia</span>
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
