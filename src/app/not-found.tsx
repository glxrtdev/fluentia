import { Compass } from 'lucide-react'

import { Logo } from '@/components/brand/logo'
import { ButtonLink } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-5 text-center">
      <Logo />

      <span className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-muted">
        <Compass className="size-5" />
      </span>

      <div>
        <h1 className="display text-2xl text-ink">Nothing lives here</h1>
        <p className="mx-auto mt-2 max-w-sm text-[0.875rem] leading-relaxed text-muted">
          The page you asked for does not exist, or it belongs to another account.
        </p>
      </div>

      <ButtonLink href="/dashboard">Back to dashboard</ButtonLink>
    </div>
  )
}
