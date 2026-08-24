import Image from 'next/image'

import mark from '@/assets/logo-mark.webp'
import { cn } from '@/lib/utils'

/**
 * The Fluentia mark. It ships on a transparent background and reads on both the
 * light canvas and the near-black panels, so it is used bare rather than inside
 * a coloured tile.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src={mark}
      alt=""
      aria-hidden
      priority
      sizes="40px"
      className={cn('size-8 shrink-0 select-none object-contain', className)}
    />
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
    <span className={cn('inline-flex items-center gap-2', className)}>
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
