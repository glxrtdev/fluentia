'use client'

import { useTransition } from 'react'
import { Check, CircleDot, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { setMistakeStatus } from '@/lib/actions/mistakes'

export function MistakeActions({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition()

  const set = (next: string) => startTransition(() => void setMistakeStatus(id, next))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="mr-1 text-[0.8125rem] text-muted">How is this one going?</p>

      {status !== 'improving' && (
        <Button size="sm" variant="secondary" loading={pending} onClick={() => set('improving')}>
          <CircleDot className="size-3.5" />
          Getting better
        </Button>
      )}
      {status !== 'resolved' && (
        <Button size="sm" loading={pending} onClick={() => set('resolved')}>
          <Check className="size-3.5" />
          I have got this
        </Button>
      )}
      {status !== 'open' && (
        <Button size="sm" variant="ghost" loading={pending} onClick={() => set('open')}>
          <RotateCcw className="size-3.5" />
          Still a problem
        </Button>
      )}
    </div>
  )
}
