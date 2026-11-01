'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { listMediaDeviceOptions } from '@/lib/recording/livekit-devices'
import type { BubbleCorner, BubbleSize } from '@/lib/clips/editor/recording-bubble'
import { buildScreenRecordStream } from '@/components/clips/editor/recording/screen-compositor'
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

export type ClipRecorderMode = 'voiceover' | 'camera' | 'screen'

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

function recorderKind(mode: ClipRecorderMode): RecorderKind {
  if (mode === 'voiceover') return 'voiceover'
  if (mode === 'screen') return 'screen'
  return 'camera'
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
  const [bubbleOn, setBubbleOnState] = useState(true)
  const [bubbleCorner, setBubbleCornerState] = useState<BubbleCorner>('se')
  const [bubbleSize, setBubbleSizeState] = useState<BubbleSize>('M')
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
  const compositorStopRef = useRef<(() => void) | null>(null)
  const canvasDimsRef = useRef<{ w: number; h: number } | null>(null)
  const stopOnceRef = useRef(false)
  const stopRecordingRef = useRef<(discard?: boolean) => Promise<ClipRecorderFinished | null>>(async () => null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setCountdownEnabledState(localStorage.getItem(lsKey(projectId, 'countdown')) !== '0')
    setMutePreviewState(localStorage.getItem(lsKey(projectId, 'mutePreview')) === '1')
    setBubbleOnState(localStorage.getItem(lsKey(projectId, 'bubble')) !== '0')
    const corner = localStorage.getItem(lsKey(projectId, 'bubbleCorner'))
    if (corner === 'se' || corner === 'sw' || corner === 'ne' || corner === 'nw') setBubbleCornerState(corner)
    const sz = localStorage.getItem(lsKey(projectId, 'bubbleSize'))
    if (sz === 'S' || sz === 'M' || sz === 'L') setBubbleSizeState(sz)
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

  const setBubbleOn = useCallback(
    (on: boolean) => {
      setBubbleOnState(on)
      localStorage.setItem(lsKey(projectId, 'bubble'), on ? '1' : '0')
    },
    [projectId],
  )

  const setBubbleCorner = useCallback(
    (c: BubbleCorner) => {
      setBubbleCornerState(c)
      localStorage.setItem(lsKey(projectId, 'bubbleCorner'), c)
    },
    [projectId],
  )

  const setBubbleSize = useCallback(
    (s: BubbleSize) => {
      setBubbleSizeState(s)
      localStorage.setItem(lsKey(projectId, 'bubbleSize'), s)
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
    compositorStopRef.current?.()
    compositorStopRef.current = null
    canvasDimsRef.current = null
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

  const micStream = useCallback(async () => {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        ...(micId ? { deviceId: micId } : {}),
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })
  }, [micId])

  const buildStream = useCallback(
    async (m: ClipRecorderMode) => {
      if (m === 'voiceover') {
        return micStream()
      }
      if (m === 'screen') {
        stopOnceRef.current = false
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 30 },
          audio: true,
        })
        const mic = await micStream()
        let cameraStream: MediaStream | null = null
        if (bubbleOn) {
          cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
              ...(cameraId ? { deviceId: cameraId } : {}),
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            },
            audio: false,
          })
        }
        const comp = await buildScreenRecordStream({
          displayStream,
          cameraStream,
          bubbleOn,
          corner: bubbleCorner,
          size: bubbleSize,
          micStream: mic,
          onDisplayEnded: () => {
            if (stopOnceRef.current || cancelRef.current) return
            stopOnceRef.current = true
            void stopRecordingRef.current(false)
          },
          onDrawStall: () => {
            import('sonner').then(({ toast }) =>
              toast.message('Keep this tab visible while recording', { id: 'rec-stall' }),
            )
          },
        })
        compositorStopRef.current = comp.stop
        canvasDimsRef.current = { w: comp.canvasW, h: comp.canvasH }
        return comp.stream
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
    [bubbleCorner, bubbleOn, bubbleSize, cameraId, micStream],
  )

  const finalizeBlob = useCallback((kind: RecorderKind) => {
    const mimeType = recorderRef.current?.mimeType || chunksRef.current[0]?.type || 'video/webm'
    const blob = new Blob(chunksRef.current, { type: mimeType })
    const measuredMs = recStartRef.current
      ? Math.max(0, Math.round(Date.now() - recStartRef.current - pausedMsRef.current))
      : 0
    const dims = canvasDimsRef.current
    const vtrack = streamRef.current?.getVideoTracks()[0]
    const settings = vtrack?.getSettings()
    return {
      blob,
      mimeType,
      measuredMs,
      kind,
      width: dims?.w ?? settings?.width,
      height: dims?.h ?? settings?.height,
    } satisfies ClipRecorderFinished
  }, [])

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
      const take = discard ? null : finalizeBlob(recorderKind(mode))
      if (take) setPendingTake(take)
      stopTracks()
      onFinishRef.current?.(take)
      return take
    },
    [finalizeBlob, mode, stopTracks],
  )

  stopRecordingRef.current = stopRecording

  const startRecording = useCallback(
    async (opts?: { onFinish?: (t: ClipRecorderFinished | null) => void }) => {
      onFinishRef.current = opts?.onFinish ?? null
      cancelRef.current = false
      stopOnceRef.current = false
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
      setPreviewStream(mode === 'camera' || mode === 'screen' ? stream : null)
      wireMeter(stream)

      const mimeKind = mode === 'voiceover' ? 'audio' : 'video'
      const mimeType = pickRecorderMime(mimeKind)
      if (!mimeType) throw new Error('Recording is not supported in this browser')

      const rec = new MediaRecorder(stream, {
        mimeType,
        ...(mode !== 'voiceover' ? { videoBitsPerSecond: VIDEO_BITS_PER_SECOND } : {}),
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
    stopOnceRef.current = true
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
    bubbleOn,
    setBubbleOn,
    bubbleCorner,
    setBubbleCorner,
    bubbleSize,
    setBubbleSize,
    analysers,
    previewStream,
    pendingTake,
    clearPendingTake: () => setPendingTake(null),
    startRecording,
    stopRecording: () => stopRecording(false),
    cancelRecording,
    teleprompterPlaying: recording && countdown == null,
    measuredDurationMs: () =>
      recStartRef.current ? Math.max(0, Date.now() - recStartRef.current - pausedMsRef.current) : 0,
    countdownLeadMs: () => (countdownEnabled ? COUNTDOWN_MS : 0),
    mimeExt,
    pickRecorderMime,
  }
}
