'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Volume2, VolumeX } from 'lucide-react'

import { cn } from '@/lib/utils'

type Status = 'idle' | 'loading' | 'playing' | 'failed'

/**
 * Says a word out loud.
 *
 * The dictionary's own recordings are a human voice and worth preferring, but
 * its media host drops out for long stretches — so a failure falls through to
 * the app's own speech instead of leaving the button dead. Both paths are
 * cached by the browser, so a repeat listen is free.
 */
export function PronounceButton({
  word,
  audioUrl,
  label,
  className,
}: {
  word: string
  audioUrl?: string | null
  /** Shows a text label beside the icon. Bare icon when omitted. */
  label?: string
  className?: string
}) {
  const [status, setStatus] = useState<Status>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(
    () => () => {
      audioRef.current?.pause()
      audioRef.current = null
    },
    [],
  )

  const play = (src: string, onFailure: () => void) => {
    const audio = audioRef.current ?? new Audio()
    audioRef.current = audio

    audio.onplaying = () => setStatus('playing')
    audio.onended = () => setStatus('idle')
    audio.onerror = onFailure

    audio.src = src
    audio.play().catch(onFailure)
  }

  const speakWithApp = () =>
    play(`/api/speech/word?word=${encodeURIComponent(word)}`, () => setStatus('failed'))

  const start = () => {
    if (status === 'playing') {
      audioRef.current?.pause()
      setStatus('idle')
      return
    }

    setStatus('loading')
    // The human recording first; the app's own voice if it does not arrive.
    if (audioUrl) play(audioUrl, speakWithApp)
    else speakWithApp()
  }

  const Icon = status === 'failed' ? VolumeX : Volume2

  return (
    <button
      type="button"
      onClick={start}
      disabled={status === 'loading'}
      title={status === 'failed' ? 'Audio is unavailable for this word' : `Hear "${word}"`}
      aria-label={`Hear how to say ${word}`}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 text-[0.75rem] font-medium transition-colors',
        status === 'failed'
          ? 'border-line text-faint'
          : status === 'playing'
            ? 'border-brand-500/30 bg-brand-500/8 text-brand-600 dark:text-brand-400'
            : 'border-line text-muted hover:border-line-strong hover:text-ink',
        status === 'loading' && 'opacity-60',
        !label && 'w-8 justify-center px-0',
        className,
      )}
    >
      {status === 'loading' ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Icon className="size-3" />
      )}
      {label && <span>{status === 'failed' ? 'No audio' : label}</span>}
    </button>
  )
}
