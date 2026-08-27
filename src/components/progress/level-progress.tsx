import { Lock, Trophy } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { bandFor, CONSISTENCY_TARGET, nextCefr } from '@/lib/domain/progression'
import { cn } from '@/lib/utils'

/**
 * Where the learner stands, and what it would take to move.
 *
 * Three separate facts, shown as three separate things: the level they hold,
 * how close recent sessions sit to the top of it, and — once the bar is full —
 * the run of sessions still needed in the band above. XP appears nowhere,
 * because it cannot move any of them.
 */
export function LevelProgress({
  cefr,
  progress,
  streak,
  className,
}: {
  cefr: string
  progress: number
  streak: number
  className?: string
}) {
  const band = bandFor(cefr)
  const target = nextCefr(cefr)
  const unlocking = progress >= 100 && target !== null

  return (
    <Card className={className}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.75rem] font-medium text-muted">Seu nível</p>
          <p className="display mt-1.5 text-4xl leading-none text-ink">{cefr}</p>
          <p className="mt-2 text-[0.8125rem] text-muted">
            Notas de {band.min} a {band.max}
          </p>
        </div>

        <div className="text-right">
          <p className="display text-2xl leading-none text-ink">{progress}%</p>
          <p className="mt-1.5 text-[0.75rem] text-faint">
            {target ? `rumo a ${target}` : 'nível máximo'}
          </p>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-pill bg-surface-2">
        <div
          className="h-full rounded-pill bg-brand-500 transition-[width] duration-500"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progresso no nível ${cefr}`}
        />
      </div>

      <p className="mt-2.5 text-[0.75rem] leading-relaxed text-faint">
        Média das suas últimas 5 sessões válidas dentro da faixa {cefr}.
      </p>

      {unlocking && (
        <div className="mt-5 rounded-control border border-brand-500/25 bg-brand-500/6 p-4">
          <p className="flex items-center gap-2 text-[0.875rem] font-semibold text-ink">
            <Lock className="size-3.5 text-brand-600 dark:text-brand-400" />
            {target} bloqueado
          </p>
          <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">
            Você atingiu 100% do seu nível atual. Agora demonstre consistência no próximo nível
            para desbloqueá-lo: {CONSISTENCY_TARGET} sessões seguidas com nota entre{' '}
            {bandFor(target).min} e {bandFor(target).max}.
          </p>

          <div className="mt-3 flex items-center gap-2">
            {/* One pip per session, so the run reads at a glance. */}
            {Array.from({ length: CONSISTENCY_TARGET }, (_, index) => (
              <span
                key={index}
                className={cn(
                  'h-1.5 flex-1 rounded-pill transition-colors',
                  index < streak ? 'bg-brand-500' : 'bg-line',
                )}
              />
            ))}
            <span className="ml-1 shrink-0 text-[0.75rem] font-medium tabular-nums text-muted">
              {streak}/{CONSISTENCY_TARGET}
            </span>
          </div>
        </div>
      )}

      {!target && (
        <p className="mt-5 flex items-center gap-2 rounded-control border border-line bg-surface-2 px-3.5 py-3 text-[0.8125rem] text-muted">
          <Trophy className="size-3.5 shrink-0 text-brand-600 dark:text-brand-400" />
          Você está no topo da escala. Daqui em diante é manutenção.
        </p>
      )}
    </Card>
  )
}
