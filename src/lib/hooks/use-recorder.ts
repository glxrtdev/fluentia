'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
]

/** Below this RMS the microphone is considered quiet. */
const SILENCE_THRESHOLD = 0.012

/*
 * How long the learner may be quiet before the turn is sent.
 *
 * Generous on purpose: pausing to think is part of speaking a second language,
 * and being cut off mid-sentence is far more disruptive than waiting. Anyone in
 * a hurry taps the stop button, which sends immediately.
 */
const SILENCE_MS = 10_000

/*
 * If nothing is ever said, give up rather than uploading noise. It has to
 * outlast SILENCE_MS: otherwise thinking before the first word would cancel the
 * recording before it began.
 */
const NO_SPEECH_TIMEOUT_MS = 15_000

const MAX_TURN_MS = 90_000

export type RecorderStatus =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'paused'
  | 'unsupported'
  | 'denied'

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

/**
 * Push-to-talk recording with voice activity detection: the learner taps once,
 * speaks, and the turn is submitted automatically when they stop talking.
 */
export function useRecorder({
  onSegment,
  onSilentTimeout,
}: {
  onSegment: (blob: Blob, durationMs: number) => void
  onSilentTimeout?: () => void
}) {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const spokeRef = useRef(false)
  const lastLoudRef = useRef(0)
  const discardRef = useRef(false)
  /** Lets the level loop be restarted after a pause without rebuilding it. */
  const tickRef = useRef<(() => void) | null>(null)
  const pausedAtRef = useRef(0)

  const teardown = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    tickRef.current = null

    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null

    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null

    recorderRef.current = null
    setLevel(0)
  }, [])

  useEffect(() => teardown, [teardown])

  const stop = useCallback((discard = false) => {
    discardRef.current = discard
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    else {
      teardown()
      setStatus('idle')
    }
  }, [teardown])

  const start = useCallback(async () => {
    if (status === 'recording' || status === 'requesting') return
    setError(null)

    const mimeType = pickMimeType()
    if (mimeType === null || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported')
      setError('This browser cannot record audio. Try Chrome, Edge or Safari.')
      return
    }

    setStatus('requesting')

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
    } catch (err) {
      setStatus('denied')
      setError(
        (err as Error)?.name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow it in your browser to speak.'
          : 'No microphone was found.',
      )
      return
    }

    streamRef.current = stream
    chunksRef.current = []
    discardRef.current = false
    spokeRef.current = false
    startedAtRef.current = performance.now()
    lastLoudRef.current = performance.now()

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    recorderRef.current = recorder

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }

    recorder.onstop = () => {
      const duration = performance.now() - startedAtRef.current
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      const discarded = discardRef.current
      const spoke = spokeRef.current

      teardown()
      setStatus('idle')

      if (discarded || blob.size === 0) return
      if (!spoke) {
        onSilentTimeout?.()
        return
      }
      onSegment(blob, Math.round(duration))
    }

    recorder.start(250)
    setStatus('recording')

    // Voice activity detection drives both the level meter and the auto-stop.
    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.5
    source.connect(analyser)

    const buffer = new Float32Array(analyser.fftSize)

    const tick = () => {
      if (recorderRef.current?.state !== 'recording') return
      analyser.getFloatTimeDomainData(buffer)

      let sum = 0
      for (let i = 0; i < buffer.length; i += 1) sum += buffer[i] * buffer[i]
      const rms = Math.sqrt(sum / buffer.length)
      setLevel(Math.min(1, rms * 12))

      const now = performance.now()
      const elapsed = now - startedAtRef.current

      if (rms > SILENCE_THRESHOLD) {
        lastLoudRef.current = now
        if (elapsed > 200) spokeRef.current = true
      }

      const quietFor = now - lastLoudRef.current

      if (spokeRef.current && quietFor > SILENCE_MS) {
        stop()
        return
      }
      if (!spokeRef.current && elapsed > NO_SPEECH_TIMEOUT_MS) {
        stop()
        return
      }
      if (elapsed > MAX_TURN_MS) {
        stop()
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    tickRef.current = tick
    rafRef.current = requestAnimationFrame(tick)
  }, [onSegment, onSilentTimeout, status, stop, teardown])

  /**
   * Holds the recording without losing it. What has been said so far stays in
   * the buffer, and the silence clocks are shifted forward on resume so the
   * pause itself is never mistaken for the learner falling quiet.
   */
  const pause = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder?.state !== 'recording') return

    recorder.pause()
    pausedAtRef.current = performance.now()

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    setLevel(0)
    setStatus('paused')
  }, [])

  const resume = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder?.state !== 'paused') return

    const held = performance.now() - pausedAtRef.current
    startedAtRef.current += held
    lastLoudRef.current += held

    recorder.resume()
    setStatus('recording')
    if (tickRef.current) rafRef.current = requestAnimationFrame(tickRef.current)
  }, [])

  return {
    status,
    level,
    error,
    recording: status === 'recording',
    paused: status === 'paused',
    preparing: status === 'requesting',
    start,
    stop,
    pause,
    resume,
    cancel: () => stop(true),
  }
}
