'use client'

import { cn } from '@/lib/utils'

export type Phase = 'ready' | 'idle' | 'listening' | 'thinking' | 'speaking' | 'paused'

const STATUS: Record<Phase, { label: string; hint: string }> = {
  ready: { label: 'Ready when you are', hint: 'Tap to let your teacher start talking' },
  idle: { label: 'Your turn', hint: 'Tap the microphone and answer out loud' },
  listening: { label: 'Listening', hint: 'Take your time — tap the square when you are done' },
  thinking: { label: 'Thinking', hint: 'Working out what to say next' },
  speaking: { label: 'Speaking', hint: 'Corrections appear beside you while it talks' },
  paused: { label: 'Paused', hint: 'Nothing is being recorded — read as long as you like' },
}

/**
 * The teacher's presence: five bars that react to the learner's voice while
 * listening, breathe while speaking, and settle while thinking.
 */
export function TeacherOrb({ phase, level }: { phase: Phase; level: number }) {
  const bars = [0.45, 0.72, 1, 0.68, 0.4]
  const status = STATUS[phase]

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="relative flex size-28 items-center justify-center sm:size-32">
        {/* Halo */}
        <span
          className={cn(
            'absolute inset-0 rounded-full transition-opacity duration-500',
            phase === 'listening' && 'bg-brand-500/25 animate-halo',
            phase === 'speaking' && 'bg-brand-500/20 animate-halo',
            phase === 'thinking' && 'bg-brand-500/15',
            (phase === 'idle' || phase === 'ready') && 'bg-brand-500/8',
          )}
        />
        <span className="absolute inset-3 rounded-full border border-line bg-surface shadow-[var(--shadow-card)]" />

        <span className="relative flex h-11 items-end gap-1.5">
          {bars.map((weight, index) => {
            const height =
              phase === 'listening'
                ? Math.max(0.16, Math.min(1, level * weight * 1.9 + 0.16))
                : phase === 'speaking'
                  ? undefined
                  : phase === 'thinking' || phase === 'paused'
                    ? 0.28
                    : weight * 0.42

            return (
              <span
                key={index}
                className={cn(
                  'w-[0.28rem] rounded-pill bg-brand-500 transition-[height] duration-100',
                  phase === 'speaking' && 'animate-bar',
                  phase === 'thinking' && 'opacity-40',
                  phase === 'paused' && 'opacity-30 grayscale',
                )}
                style={
                  phase === 'speaking'
                    ? {
                        height: `${weight * 100}%`,
                        animationDelay: `${index * 0.11}s`,
                        transformOrigin: 'bottom',
                      }
                    : { height: `${(height ?? 0.4) * 100}%` }
                }
              />
            )
          })}
        </span>
      </div>

      <div>
        <p
          aria-live="polite"
          className="text-[0.9375rem] font-semibold text-ink"
        >
          {status.label}
        </p>
        <p className="mt-1 text-[0.8125rem] text-muted">{status.hint}</p>
      </div>
    </div>
  )
}
