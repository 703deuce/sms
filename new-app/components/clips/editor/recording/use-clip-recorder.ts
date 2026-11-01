'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { listMediaDeviceOptions } from '@/lib/recording/livekit-devices'
import {
  AUDIO_BITS_PER_SECOND,
  RECORD_MAX_MS,
  RECORD_WARN_MS,
  VIDEO_BITS_PER_SECOND,
  estimateTakeBytes,
  mimeExt,
  pickRecorderMime,
  type RecorderKind,
  type VideoPlaceMode,
} from '@/lib/clips/editor/recording'

export type ClipRecorderMode = 'voiceover' | 'camera'

export type ClipRecorderFinished = {
  blob: Blob
  mimeType: string
  measuredMs: number
  kind: RecorderKind
  width?: number
  height?: number
}

const COUNTDOWN_MS = 3000

function lsKey(projectId: string, key: string) {
  return `clip-rec:${projectId}:${key}`
}

export function useClipRecorder(projectId: string) {
  const [armed, setArmed] = useState(false)
  const [mode, setMode] = useState<ClipRecorderMode>('voiceover')
  const [recording, setRecording] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [recSeconds, setRecSeconds] = useState(0)
  const [cameras, setCameras] = useState<{ deviceId: string; label: string }[]>([])
  const [mics, setMics] = useState<{ deviceId: string; label: string }[]>([])
  const [cameraId, setCameraId] = useState('')
  const [micId, setMicId] = useState('')
  const [countdownEnabled, setCountdownEnabledState] = useState(true)
  const [mutePreview, setMutePreviewState] = useState(false)
  const [placeMode, setPlaceMode] = useState<VideoPlaceMode>('insert')
  const [analysers, setAnalysers] = useState<[AnalyserNode | null, AnalyserNode | null] | null>(null)
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null)
  const [pendingTake, setPendingTake] = useState<ClipRecorderFinished | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recStartRef = useRef<number | null>(null)
  const pausedMsRef = useRef(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const cancelRef = useRef(false)
  const onFinishRef = useRef<((t: ClipRecorderFinished | null) => void) | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setCountdownEnabledState(localStorage.getItem(lsKey(projectId, 'countdown')) !== '0')
    setMutePreviewState(localStorage.getItem(lsKey(projectId, 'mutePreview')) === '1')
  }, [projectId])

  const setCountdownEnabled = useCallback(
    (on: boolean) => {
      setCountdownEnabledState(on)
      localStorage.setItem(lsKey(projectId, 'countdown'), on ? '1' : '0')
    },
    [projectId],
  )

  const setMutePreview = useCallback(
    (on: boolean) => {
      setMutePreviewState(on)
      localStorage.setItem(lsKey(projectId, 'mutePreview'), on ? '1' : '0')
    },
    [projectId],
  )

  useEffect(() => {
    if (!armed) return
    void listMediaDeviceOptions('videoinput').then(setCameras)
    void listMediaDeviceOptions('audioinput').then(setMics)
  }, [armed])

  useEffect(() => {
    if (!recording) return
    const id = window.setInterval(() => {
      if (recStartRef.current) setRecSeconds(Math.floor((Date.now() - recStartRef.current - pausedMsRef.current) / 1000))
    }, 400)
    return () => window.clearInterval(id)
  }, [recording])

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks?.().forEach((t) => t.stop())
    streamRef.current = null
    setPreviewStream(null)
    void audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    setAnalysers(null)
    recorderRef.current = null
  }, [])

  useEffect(() => () => stopTracks(), [stopTracks])

  const wireMeter = useCallback((stream: MediaStream) => {
    const track = stream.getAudioTracks()[0]
    if (!track) {
      setAnalysers(null)
      return
    }
    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    const src = ctx.createMediaStreamSource(new MediaStream([track]))
    const aL = ctx.createAnalyser()
    const aR = ctx.createAnalyser()
    aL.fftSize = 2048
    aR.fftSize = 2048
    src.connect(aL)
    src.connect(aR)
    setAnalysers([aL, aR])
  }, [])

  const buildStream = useCallback(
    async (m: ClipRecorderMode) => {
      if (m === 'voiceover') {
        return navigator.mediaDevices.getUserMedia({
          audio: {
            ...(micId ? { deviceId: micId } : {}),
            echoCancellation: true,
            noiseSuppression: false,
            autoGainControl: false,
          },
        })
      }
      return navigator.mediaDevices.getUserMedia({
        video: {
          ...(cameraId ? { deviceId: cameraId } : {}),
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: {
          ...(micId ? { deviceId: micId } : {}),
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
    },
    [cameraId, micId],
  )

  const finalizeBlob = useCallback(
    (kind: RecorderKind) => {
      const mimeType = recorderRef.current?.mimeType || chunksRef.current[0]?.type || 'video/webm'
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const measuredMs = recStartRef.current
        ? Math.max(0, Math.round(Date.now() - recStartRef.current - pausedMsRef.current))
        : 0
      const vtrack = streamRef.current?.getVideoTracks()[0]
      const settings = vtrack?.getSettings()
      return {
        blob,
        mimeType,
        measuredMs,
        kind,
        width: settings?.width,
        height: settings?.height,
      } satisfies ClipRecorderFinished
    },
    [],
  )

  const stopRecording = useCallback(
    async (discard?: boolean) => {
      const rec = recorderRef.current
      cancelRef.current = Boolean(discard)
      setRecording(false)
      setCountdown(null)
      if (!rec || rec.state === 'inactive') {
        if (discard) {
          chunksRef.current = []
          stopTracks()
        }
        return null
      }
      await new Promise<void>((resolve) => {
        rec.addEventListener('stop', () => resolve(), { once: true })
        rec.stop()
      })
      const take = discard ? null : finalizeBlob(mode === 'voiceover' ? 'voiceover' : 'camera')
      if (take) setPendingTake(take)
      stopTracks()
      onFinishRef.current?.(take)
      return take
    },
    [finalizeBlob, mode, stopTracks],
  )

  const startRecording = useCallback(
    async (opts?: { onFinish?: (t: ClipRecorderFinished | null) => void }) => {
      onFinishRef.current = opts?.onFinish ?? null
      cancelRef.current = false
      chunksRef.current = []
      pausedMsRef.current = 0

      if (countdownEnabled) {
        let left = 3
        setCountdown(left)
        await new Promise<void>((resolve) => {
          const tick = window.setInterval(() => {
            left -= 1
            if (left <= 0) {
              window.clearInterval(tick)
              setCountdown(null)
              resolve()
            } else setCountdown(left)
          }, 1000)
        })
      }

      const stream = await buildStream(mode)
      streamRef.current = stream
      setPreviewStream(mode === 'camera' ? stream : null)
      wireMeter(stream)

      const mimeKind = mode === 'voiceover' ? 'audio' : 'video'
      const mimeType = pickRecorderMime(mimeKind)
      if (!mimeType) throw new Error('Recording is not supported in this browser')

      const rec = new MediaRecorder(stream, {
        mimeType,
        ...(mode === 'camera' ? { videoBitsPerSecond: VIDEO_BITS_PER_SECOND } : {}),
      })
      recorderRef.current = rec
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data)
      }
      rec.start(1000)
      recStartRef.current = Date.now()
      setRecording(true)
      setRecSeconds(0)

      const bitrate = mode === 'voiceover' ? AUDIO_BITS_PER_SECOND : VIDEO_BITS_PER_SECOND
      const warnAt = recStartRef.current + RECORD_WARN_MS
      const stopAt = recStartRef.current + RECORD_MAX_MS

      const guard = window.setInterval(() => {
        if (!recStartRef.current || cancelRef.current) return
        const elapsed = Date.now() - recStartRef.current - pausedMsRef.current
        if (Date.now() >= warnAt && Date.now() < warnAt + 1500) {
          import('sonner').then(({ toast }) => toast.message('Recording will stop at 30 minutes', { id: 'rec-max' }))
        }
        const est = estimateTakeBytes(elapsed, bitrate)
        void import('@/lib/clips/upload').then(({ fetchUploadLimits }) =>
          fetchUploadLimits().then((lim) => {
            if (est >= lim.effectiveMaxBytes * 0.95) void stopRecording(false)
          }),
        )
        if (Date.now() >= stopAt) void stopRecording(false)
      }, 2000)

      rec.addEventListener(
        'stop',
        () => {
          window.clearInterval(guard)
        },
        { once: true },
      )
    },
    [buildStream, countdownEnabled, mode, stopRecording, wireMeter],
  )

  const cancelRecording = useCallback(async () => {
    await stopRecording(true)
    setPendingTake(null)
    setArmed(false)
  }, [stopRecording])

  const disarm = useCallback(() => {
    void cancelRecording()
  }, [cancelRecording])

  const arm = useCallback((m: ClipRecorderMode) => {
    setMode(m)
    setArmed(true)
  }, [])

  return {
    armed,
    setArmed,
    arm,
    disarm,
    mode,
    recording,
    countdown,
    recSeconds,
    cameras,
    mics,
    cameraId,
    setCameraId,
    micId,
    setMicId,
    countdownEnabled,
    setCountdownEnabled,
    mutePreview,
    setMutePreview,
    placeMode,
    setPlaceMode,
    analysers,
    previewStream,
    pendingTake,
    clearPendingTake: () => setPendingTake(null),
    startRecording,
    stopRecording: () => stopRecording(false),
    cancelRecording,
    measuredDurationMs: () =>
      recStartRef.current ? Math.max(0, Date.now() - recStartRef.current - pausedMsRef.current) : 0,
    countdownLeadMs: () => (countdownEnabled ? COUNTDOWN_MS : 0),
    mimeExt,
    pickRecorderMime,
  }
}
