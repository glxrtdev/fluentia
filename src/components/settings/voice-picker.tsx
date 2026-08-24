'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Play, Square, Volume2 } from 'lucide-react'

import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { VOICES, VOICE_SAMPLE } from '@/lib/voices'

const OPTIONS = VOICES.map((voice) => ({
  value: voice.id,
  label: voice.label,
  description: voice.description,
}))

type Status = 'idle' | 'loading' | 'playing'

/**
 * Picking a voice by name is guesswork, so the voice introduces itself the
 * moment it is selected. The audio is cached per voice, so going back to one
 * you already heard is instant and free.
 */
export function VoicePicker({ defaultValue }: { defaultValue: string }) {
  const [status, setStatus] = useState<Status>('idle')
  const [voice, setVoice] = useState(defaultValue)
  const [error, setError] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Never let a sample keep playing after the panel is gone.
  useEffect(
    () => () => {
      audioRef.current?.pause()
      audioRef.current = null
    },
    [],
  )

  const stop = () => {
    audioRef.current?.pause()
    setStatus('idle')
  }

  const play = (id: string) => {
    const audio = audioRef.current ?? new Audio()
    audioRef.current = audio

    audio.onplaying = () => setStatus('playing')
    audio.onended = () => setStatus('idle')
    audio.onerror = () => {
      setStatus('idle')
      setError('That voice could not be played. Check your OpenAI key.')
    }

    setError(null)
    setStatus('loading')
    audio.src = `/api/speech/preview?voice=${encodeURIComponent(id)}`
    audio.play().catch(() => {
      setStatus('idle')
      setError('Playback was blocked by the browser.')
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <Select
          name="voice"
          options={OPTIONS}
          defaultValue={defaultValue}
          className="flex-1"
          onChange={(next) => {
            setVoice(next)
            play(next)
          }}
        />

        <button
          type="button"
          onClick={() => (status === 'playing' ? stop() : play(voice))}
          disabled={status === 'loading'}
          aria-label={status === 'playing' ? 'Stop the sample' : 'Hear this voice'}
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-control border transition-colors',
            status === 'playing'
              ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400'
              : 'border-line text-muted hover:border-line-strong hover:text-ink',
            status === 'loading' && 'opacity-60',
          )}
        >
          {status === 'loading' ? (
            <Loader2 className="size-4 animate-spin" />
          ) : status === 'playing' ? (
            <Square className="size-3.5 fill-current" />
          ) : (
            <Play className="size-3.5 fill-current" />
          )}
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-xs font-medium text-rose">
          {error}
        </p>
      ) : (
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
          <Volume2 className="mt-0.5 size-3 shrink-0" />
          <span>
            Picking a voice plays &ldquo;{VOICE_SAMPLE}&rdquo; — one short speech call on your
            OpenAI account, then cached.
          </span>
        </p>
      )}
    </div>
  )
}
