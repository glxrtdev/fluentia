'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  Headphones,
  Loader2,
  Mic,
  Pause,
  PhoneOff,
  Play,
  RotateCcw,
  Volume2,
  X,
} from 'lucide-react'

import { FeedbackPanel, type LiveCorrection } from '@/components/conversation/feedback-panel'
import { TeacherOrb, type Phase } from '@/components/conversation/teacher-orb'
import { Transcript } from '@/components/conversation/transcript'
import { Button } from '@/components/ui/button'
import { discardConversation } from '@/lib/actions/conversation'
import { useRecorder } from '@/lib/hooks/use-recorder'
import { cn, formatClock, LEVEL_LABELS } from '@/lib/utils'

export type RoomMessage = { id: string; role: 'user' | 'assistant'; content: string }

type Props = {
  conversationId: string
  topicLabel: string
  level: string
  initialMessages: RoomMessage[]
  initialCorrections: LiveCorrection[]
  elapsedSeconds: number
  hasUserTurns: boolean
}

export function ConversationRoom({
  conversationId,
  topicLabel,
  level,
  initialMessages,
  initialCorrections,
  elapsedSeconds,
  hasUserTurns,
}: Props) {
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>('ready')
  const [messages, setMessages] = useState<RoomMessage[]>(initialMessages)
  const [corrections, setCorrections] = useState<LiveCorrection[]>(initialCorrections)
  const [handsFree, setHandsFree] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seconds, setSeconds] = useState(elapsedSeconds)
  const [ending, setEnding] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [spokeOnce, setSpokeOnce] = useState(hasUserTurns)
  const [mobileTab, setMobileTab] = useState<'conversation' | 'feedback'>('conversation')
  const [discarding, startDiscard] = useTransition()
  const [activeCorrection, setActiveCorrection] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const handsFreeRef = useRef(handsFree)
  handsFreeRef.current = handsFree
  // Lets `play` hand control back to the recorder without depending on it.
  const startListeningRef = useRef<() => void>(() => {})
  /*
   * Once the session is over — ended, discarded or navigated away from — a turn
   * that is still in flight must not start talking. Without this, answering and
   * then ending straight away left the teacher speaking over the report page.
   */
  const liveRef = useRef(true)
  const pausedRef = useRef(false)
  /** A reply that arrived while paused waits here instead of talking over you. */
  const pendingPlayRef = useRef<string | null>(null)
  const turnAbort = useRef<AbortController | null>(null)

  const lastAssistant = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'assistant'),
    [messages],
  )

  /* ------------------------------------------------------------- timer */

  useEffect(() => {
    // Time spent reading is not time spent practising, so the clock stops too.
    if (phase === 'ready' || paused) return
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => clearInterval(timer)
  }, [phase, paused])

  // Never let the teacher keep talking after the learner navigates away.
  useEffect(
    () => () => {
      liveRef.current = false
      turnAbort.current?.abort()
      audioRef.current?.pause()
      audioRef.current = null
    },
    [],
  )

  /* ---------------------------------------------------------- playback */

  const play = useCallback((messageId: string) => {
    if (!liveRef.current) return
    if (pausedRef.current) {
      // Hold it: the learner is reading, not listening.
      pendingPlayRef.current = messageId
      return
    }
    const audio = audioRef.current ?? new Audio()
    audioRef.current = audio

    // The teacher's turn ends, the learner's begins — that chain is the whole loop.
    audio.onended = () => {
      setPhase('idle')
      if (handsFreeRef.current && !pausedRef.current) startListeningRef.current()
    }
    audio.onerror = () => {
      setPhase('idle')
      setNotice('The audio could not be played. The transcript is still there.')
    }

    audio.src = `/api/speech?messageId=${encodeURIComponent(messageId)}`
    setPhase('speaking')
    audio.play().catch(() => {
      // Autoplay blocked or playback failed: hand the turn back to the learner.
      setPhase('idle')
      setNotice('Tap the replay button to hear the teacher.')
    })
  }, [])

  /* --------------------------------------------------------- recording */

  const sendTurn = useCallback(
    async (blob: Blob, durationMs: number) => {
      setPhase('thinking')
      setError(null)
      setNotice(null)

      const body = new FormData()
      body.set('audio', new File([blob], 'turn.webm', { type: blob.type || 'audio/webm' }))
      body.set('audioMs', String(durationMs))

      turnAbort.current = new AbortController()

      try {
        const response = await fetch(`/api/conversations/${conversationId}/turn`, {
          method: 'POST',
          body,
          signal: turnAbort.current.signal,
        })
        const data = await response.json()
        if (!liveRef.current) return

        if (!response.ok) {
          setError(data?.error ?? 'Something went wrong. Try again.')
          setPhase('idle')
          return
        }

        if (data.empty) {
          setNotice('I could not hear that. Try again a little closer to the mic.')
          setPhase('idle')
          return
        }

        setSpokeOnce(true)
        setMessages((current) => [
          ...current,
          { id: data.userMessage.id, role: 'user', content: data.userMessage.content },
          { id: data.assistantMessage.id, role: 'assistant', content: data.assistantMessage.content },
        ])
        if (Array.isArray(data.corrections) && data.corrections.length > 0) {
          setCorrections((current) => [...current, ...data.corrections])
        }

        play(data.assistantMessage.id)
      } catch (err) {
        // Aborting on purpose is not a failure worth reporting.
        if ((err as Error)?.name === 'AbortError' || !liveRef.current) return
        setError('The connection dropped. Your session is still saved.')
        setPhase('idle')
      }
    },
    [conversationId, play],
  )

  const recorder = useRecorder({
    onSegment: sendTurn,
    onSilentTimeout: () => {
      setPhase('idle')
      setNotice('I did not hear anything — tap the mic when you are ready.')
    },
  })

  startListeningRef.current = () => void recorder.start()

  useEffect(() => {
    if (recorder.recording) setPhase('listening')
  }, [recorder.recording])

  useEffect(() => {
    if (recorder.error) setError(recorder.error)
  }, [recorder.error])

  /* ------------------------------------------------------------- pause */

  /**
   * Holds the whole session so the learner can read.
   *
   * Everything in flight is suspended rather than thrown away: the teacher's
   * audio keeps its position, a half-spoken answer stays in the recorder, and a
   * reply that lands mid-pause waits its turn. Resuming picks up whichever of
   * those was happening.
   */
  const togglePause = () => {
    if (!paused) {
      pausedRef.current = true
      setPaused(true)
      audioRef.current?.pause()
      recorder.pause()
      return
    }

    pausedRef.current = false
    setPaused(false)

    if (recorder.paused) {
      recorder.resume()
      setPhase('listening')
      return
    }

    const held = pendingPlayRef.current
    if (held) {
      pendingPlayRef.current = null
      play(held)
      return
    }

    const audio = audioRef.current
    if (audio && audio.paused && audio.currentTime > 0 && !audio.ended) {
      setPhase('speaking')
      void audio.play().catch(() => setPhase('idle'))
      return
    }

    setPhase('idle')
  }

  /* ------------------------------------------------------------- start */

  const begin = () => {
    setPhase('idle')
    // The click is the gesture browsers need before any audio can play.
    if (lastAssistant) play(lastAssistant.id)
    else void recorder.start()
  }

  /* --------------------------------------------------------------- end */

  const endSession = async () => {
    setEnding(true)
    setError(null)
    liveRef.current = false
    turnAbort.current?.abort()
    audioRef.current?.pause()
    audioRef.current = null
    recorder.cancel()

    try {
      const response = await fetch(`/api/conversations/${conversationId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationSeconds: seconds,
          tzOffset: new Date().getTimezoneOffset(),
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        // The session survives a failed report, so speaking can resume.
        liveRef.current = true
        setError(data?.error ?? 'The report could not be generated.')
        setEnding(false)
        setConfirmEnd(false)
        return
      }

      router.replace(`/sessions/${conversationId}`)
    } catch {
      liveRef.current = true
      setError('The report could not be generated. Try again.')
      setEnding(false)
    }
  }

  const selectCorrection = (id: string) => {
    setActiveCorrection(id)
    setMobileTab('feedback')
  }

  const busy = phase === 'thinking' || recorder.preparing

  /* ------------------------------------------------------------- render */

  const micButton = (
    <div className="flex flex-col items-center gap-4">
      {phase === 'ready' ? (
        <Button size="lg" onClick={begin} className="px-8">
          <Volume2 className="size-4" />
          Start the conversation
        </Button>
      ) : (
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={togglePause}
            aria-pressed={paused}
            aria-label={paused ? 'Resume the session' : 'Pause the session'}
            className={cn(
              'rounded-full border p-3 transition-colors',
              paused
                ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400'
                : 'border-line bg-surface text-muted hover:text-ink',
            )}
          >
            {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
          </button>

          <button
            type="button"
            onClick={() => (recorder.recording ? recorder.stop() : void recorder.start())}
            disabled={busy || paused || phase === 'speaking'}
            aria-label={recorder.recording ? 'Stop recording' : 'Start speaking'}
            className={cn(
              'relative flex size-16 items-center justify-center rounded-full transition-all duration-200 active:scale-95 disabled:opacity-40',
              recorder.recording
                ? 'bg-rose text-white'
                : 'bg-brand-500 text-white hover:bg-brand-600',
            )}
          >
            {recorder.recording && (
              <span
                className="absolute inset-0 rounded-full bg-rose/30"
                style={{ transform: `scale(${1 + recorder.level * 0.5})` }}
              />
            )}
            {busy ? (
              <Loader2 className="size-6 animate-spin" />
            ) : recorder.recording ? (
              <span className="size-5 rounded-[0.25rem] bg-current" />
            ) : (
              <Mic className="size-6" />
            )}
          </button>

          {lastAssistant && phase !== 'speaking' && !paused && (
            <button
              type="button"
              onClick={() => play(lastAssistant.id)}
              aria-label="Replay the last thing the teacher said"
              className="rounded-full border border-line bg-surface p-3 text-muted transition-colors hover:text-ink"
            >
              <RotateCcw className="size-4" />
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setHandsFree((value) => !value)}
        aria-pressed={handsFree}
        disabled={paused}
        className={cn(
          'inline-flex items-center gap-2 rounded-pill border px-3.5 py-1.5 text-xs font-medium transition-colors',
          handsFree
            ? 'border-brand-500/30 bg-brand-500/8 text-brand-600 dark:text-brand-400'
            : 'border-line text-muted hover:text-ink',
        )}
      >
        <Headphones className="size-3.5" />
        Hands-free {handsFree ? 'on' : 'off'}
      </button>
    </div>
  )

  return (
    <div data-room className="flex h-[calc(100dvh-3.5rem)] flex-col lg:h-dvh">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{topicLabel}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <span>{LEVEL_LABELS[level] ?? level}</span>
            <span className="text-faint">·</span>
            {/* A frozen number reads as a bug unless it says why it stopped. */}
            <span className={cn('tabular-nums', paused && 'text-faint')}>
              {formatClock(seconds)}
            </span>
            {paused && (
              <span className="inline-flex items-center gap-1 rounded-pill bg-brand-500/10 px-2 py-0.5 text-[0.6875rem] font-medium text-brand-600 dark:text-brand-400">
                <Pause className="size-2.5" />
                Paused
              </span>
            )}
          </p>
        </div>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => setConfirmEnd(true)}
          disabled={ending}
          className="shrink-0"
        >
          <PhoneOff className="size-3.5" />
          End session
        </Button>
      </header>

      {/* Mobile tabs */}
      <div className="flex border-b border-line lg:hidden">
        {(['conversation', 'feedback'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMobileTab(tab)}
            className={cn(
              'flex-1 py-2.5 text-[0.8125rem] font-medium capitalize transition-colors',
              mobileTab === tab
                ? 'border-b-2 border-brand-500 text-ink'
                : 'text-muted hover:text-ink',
            )}
          >
            {tab}
            {tab === 'feedback' && corrections.length > 0 && (
              <span className="ml-1.5 rounded-pill bg-surface-2 px-1.5 py-0.5 text-[0.625rem] font-semibold">
                {corrections.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Stage */}
        <section
          className={cn(
            'flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-8',
            mobileTab === 'feedback' && 'hidden lg:flex',
          )}
        >
          <div className="flex flex-col items-center gap-6">
            <TeacherOrb phase={paused ? 'paused' : phase} level={recorder.level} />
          </div>

          {/*
            This wrapper must be a flex column: the transcript sizes itself from
            it, and without that it grew past the viewport and was simply clipped
            instead of scrolling.
          */}
          <div className="mx-auto mt-6 flex min-h-0 w-full max-w-2xl flex-1 flex-col">
            <Transcript
              messages={messages}
              corrections={corrections}
              thinking={phase === 'thinking'}
              activeCorrectionId={activeCorrection}
              onSelectCorrection={selectCorrection}
            />
          </div>

          {(notice || error) && (
            <div
              role="status"
              className={cn(
                'mx-auto mb-4 flex w-full max-w-2xl items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[0.8125rem]',
                error
                  ? 'border-rose/25 bg-rose/8 font-medium text-rose'
                  : 'border-line bg-surface-2 text-muted',
              )}
            >
              {error && <AlertCircle className="mt-px size-4 shrink-0" />}
              <span className="flex-1">{error ?? notice}</span>
              <button
                type="button"
                onClick={() => (error ? setError(null) : setNotice(null))}
                aria-label="Dismiss"
                className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          <div data-mic className="flex justify-center pt-2">{micButton}</div>
        </section>

        {/* Feedback */}
        <aside
          className={cn(
            'min-h-0 w-full border-line lg:w-[22rem] lg:border-l xl:w-96',
            mobileTab === 'conversation' ? 'hidden lg:block' : 'block',
          )}
        >
          <FeedbackPanel
            corrections={corrections}
            activeId={activeCorrection}
            onSelect={setActiveCorrection}
          />
        </aside>
      </div>

      {/* End-of-session dialog */}
      {confirmEnd && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="end-session-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center"
        >
          <div className="w-full max-w-sm animate-fade-up rounded-card border border-line bg-surface p-6 shadow-[var(--shadow-lift)]">
            <h2 id="end-session-title" className="display text-xl text-ink">
              {spokeOnce ? 'End this session?' : 'Leave without speaking?'}
            </h2>
            <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
              {spokeOnce
                ? 'Fluentia will score this conversation, save your mistakes and update your profile. It takes a few seconds.'
                : 'You have not said anything yet, so there is nothing to score. The session will simply be discarded.'}
            </p>

            {error && <p className="mt-4 text-[0.8125rem] font-medium text-rose">{error}</p>}

            <div className="mt-6 flex flex-col gap-2">
              {spokeOnce ? (
                <Button onClick={endSession} loading={ending}>
                  End and see my report
                </Button>
              ) : (
                <Button
                  variant="danger"
                  loading={discarding}
                  onClick={() => {
                    liveRef.current = false
                    turnAbort.current?.abort()
                    audioRef.current?.pause()
                    recorder.cancel()
                    startDiscard(() => void discardConversation(conversationId))
                  }}
                >
                  Discard session
                </Button>
              )}
              <Button variant="ghost" onClick={() => setConfirmEnd(false)} disabled={ending}>
                Keep talking
              </Button>
            </div>
          </div>
        </div>
      )}

      {ending && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-canvas/92 backdrop-blur-sm">
          <Loader2 className="size-6 animate-spin text-brand-500" />
          <p className="text-sm font-medium text-ink">Scoring your conversation…</p>
          <p className="max-w-xs text-center text-[0.8125rem] text-muted">
            Reading the transcript, updating your mistakes and your English profile.
          </p>
        </div>
      )}
    </div>
  )
}
