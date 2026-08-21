'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  Headphones,
  Loader2,
  Mic,
  PhoneOff,
  RotateCcw,
  Volume2,
  X,
} from 'lucide-react'

import { FeedbackPanel, type LiveCorrection } from '@/components/conversation/feedback-panel'
import { TeacherOrb, type Phase } from '@/components/conversation/teacher-orb'
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

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const handsFreeRef = useRef(handsFree)
  handsFreeRef.current = handsFree
  // Lets `play` hand control back to the recorder without depending on it.
  const startListeningRef = useRef<() => void>(() => {})

  const lastAssistant = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'assistant'),
    [messages],
  )

  /* ------------------------------------------------------------- timer */

  useEffect(() => {
    if (phase === 'ready') return
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => clearInterval(timer)
  }, [phase])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Never let the teacher keep talking after the learner navigates away.
  useEffect(
    () => () => {
      audioRef.current?.pause()
      audioRef.current = null
    },
    [],
  )

  /* ---------------------------------------------------------- playback */

  const play = useCallback((messageId: string) => {
    const audio = audioRef.current ?? new Audio()
    audioRef.current = audio

    // The teacher's turn ends, the learner's begins — that chain is the whole loop.
    audio.onended = () => {
      setPhase('idle')
      if (handsFreeRef.current) startListeningRef.current()
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

      try {
        const response = await fetch(`/api/conversations/${conversationId}/turn`, {
          method: 'POST',
          body,
        })
        const data = await response.json()

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
      } catch {
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
    audioRef.current?.pause()
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
        setError(data?.error ?? 'The report could not be generated.')
        setEnding(false)
        setConfirmEnd(false)
        return
      }

      router.replace(`/sessions/${conversationId}`)
    } catch {
      setError('The report could not be generated. Try again.')
      setEnding(false)
    }
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
            onClick={() => (recorder.recording ? recorder.stop() : void recorder.start())}
            disabled={busy || phase === 'speaking'}
            aria-label={recorder.recording ? 'Stop recording' : 'Start speaking'}
            className={cn(
              'relative flex size-16 items-center justify-center rounded-full transition-all duration-200 active:scale-95 disabled:opacity-40',
              recorder.recording
                ? 'bg-rose text-white shadow-lg'
                : 'bg-brand-600 text-white shadow-md hover:bg-brand-700 dark:bg-brand-500 dark:text-[#04201d]',
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

          {lastAssistant && phase !== 'speaking' && (
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
        className={cn(
          'inline-flex items-center gap-2 rounded-pill border px-3.5 py-1.5 text-xs font-medium transition-colors',
          handsFree
            ? 'border-brand-500/30 bg-brand-500/8 text-brand-700 dark:text-brand-300'
            : 'border-line text-muted hover:text-ink',
        )}
      >
        <Headphones className="size-3.5" />
        Hands-free {handsFree ? 'on' : 'off'}
      </button>
    </div>
  )

  const transcript = (
    <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-1 py-2 scroll-slim">
      {messages.map((message) => (
        <div key={message.id} className="animate-fade-in">
          <p className="mb-1 text-[0.625rem] font-bold uppercase tracking-[0.16em] text-faint">
            {message.role === 'assistant' ? 'Teacher' : 'You'}
          </p>
          <p
            className={cn(
              'text-[0.9375rem] leading-relaxed',
              message.role === 'assistant' ? 'text-ink' : 'text-ink-soft',
            )}
          >
            {message.content}
          </p>
        </div>
      ))}
      {phase === 'thinking' && (
        <p className="flex items-center gap-2 text-[0.8125rem] text-muted">
          <Loader2 className="size-3.5 animate-spin" />
          Transcribing and thinking…
        </p>
      )}
    </div>
  )

  return (
    <div data-room className="flex h-[calc(100dvh-3.5rem)] flex-col lg:h-dvh">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{topicLabel}</p>
          <p className="text-xs text-muted">
            {LEVEL_LABELS[level] ?? level} · <span className="tabular-nums">{formatClock(seconds)}</span>
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
            <TeacherOrb phase={phase} level={recorder.level} />
          </div>

          <div className="mx-auto mt-6 min-h-0 w-full max-w-2xl flex-1 overflow-hidden">
            {transcript}
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

          <div className="flex justify-center pt-2">{micButton}</div>
        </section>

        {/* Feedback */}
        <aside
          className={cn(
            'min-h-0 w-full border-line lg:w-[22rem] lg:border-l xl:w-96',
            mobileTab === 'conversation' ? 'hidden lg:block' : 'block',
          )}
        >
          <FeedbackPanel corrections={corrections} />
        </aside>
      </div>

      {/* End-of-session dialog */}
      {confirmEnd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-sm animate-fade-up rounded-card border border-line bg-surface p-6 shadow-[var(--shadow-lift)]">
            <h2 className="display text-xl text-ink">
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
