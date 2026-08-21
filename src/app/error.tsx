'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

import { Logo } from '@/components/brand/logo'
import { Button, ButtonLink } from '@/components/ui/button'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-5 text-center">
      <Logo />

      <span className="flex size-11 items-center justify-center rounded-full bg-rose/10 text-rose">
        <AlertTriangle className="size-5" />
      </span>

      <div>
        <h1 className="display text-2xl text-ink">Something broke on our side</h1>
        <p className="mx-auto mt-2 max-w-sm text-[0.875rem] leading-relaxed text-muted">
          Your conversations, mistakes and vocabulary are safe in the database. Try again, or head
          back to the dashboard.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-[0.6875rem] text-faint">ref {error.digest}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>
          <RotateCcw className="size-4" />
          Try again
        </Button>
        <ButtonLink href="/dashboard" variant="secondary">
          Back to dashboard
        </ButtonLink>
      </div>
    </div>
  )
}
