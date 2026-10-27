'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { startLocalTrackRecorder } from '@/lib/recording/local-track-recorder'
import { TrackUploadManager, type TrackUploadProgress } from '@/lib/recording/track-upload-manager'
import { createId } from '@/lib/supabase/id'
import { listMediaDeviceOptions } from '@/lib/recording/livekit-devices'

export type RecordingImportResult = {
  projectId: string
  clipsUrl: string
  scriptUrl: string
}

export function useEditorRecorder(
  projectId: string,
  opts?: { onImportComplete?: (result: RecordingImportResult) => void },
) {
  const onImportRef = useRef(opts?.onImportComplete)
  onImportRef.current = opts?.onImportComplete
  const [armed, setArmed] = useState(false)
  const [recording, setRecording] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [recSeconds, setRecSeconds] = useState(0)
  const [uploadRows, setUploadRows] = useState<TrackUploadProgress[]>([])
  const [cameras, setCameras] = useState<{ deviceId: string; label: string }[]>([])
  const [mics, setMics] = useState<{ deviceId: string; label: string }[]>([])
  const [cameraId, setCameraId] = useState<string>('')
  const [micId, setMicId] = useState<string>('')
  const [countdownEnabled, setCountdownEnabled] = useState(true)
  const streamRef = useRef<MediaStream | null>(null)
  const recordersRef = useRef<{ stop: () => Promise<void> }[]>([])
  const sessionIdRef = useRef<string | null>(null)
  const participantIdRef = useRef<string | null>(null)
  const takeIdRef = useRef<string | null>(null)
  const uploadMgr = useRef<TrackUploadManager | null>(null)
  const recStartRef = useRef<number | null>(null)

  useEffect(() => {
    void listMediaDeviceOptions('videoinput').then(setCameras)
    void listMediaDeviceOptions('audioinput').then(setMics)
  }, [projectId])

  useEffect(() => {
    if (!recording) return
    const id = window.setInterval(() => {
      if (recStartRef.current) setRecSeconds(Math.floor((Date.now() - recStartRef.current) / 1000))
    }, 400)
    return () => window.clearInterval(id)
  }, [recording])

  const ensureEditorSession = useCallback(async () => {
    if (sessionIdRef.current && participantIdRef.current) {
      return { sessionId: sessionIdRef.current, participantId: participantIdRef.current }
    }
    const res = await fetch(`/api/recording/projects/${projectId}/editor-session`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Could not start editor session')
    sessionIdRef.current = json.data.sessionId as string
    participantIdRef.current = json.data.participantId as string
    uploadMgr.current = new TrackUploadManager(sessionIdRef.current, setUploadRows)
    return { sessionId: sessionIdRef.current, participantId: participantIdRef.current }
  }, [projectId])

  const ensureStream = useCallback(async () => {
    if (streamRef.current) return streamRef.current
    const stream = await navigator.mediaDevices.getUserMedia({
      video: cameraId ? { deviceId: cameraId } : true,
      audio: micId ? { deviceId: micId } : true,
    })
    streamRef.current = stream
    return stream
  }, [cameraId, micId])

  const startRecording = useCallback(async () => {
    const { sessionId, participantId } = await ensureEditorSession()
    const startAtHostMs = Date.now() + (countdownEnabled ? 3000 : 0)
    const takeRes = await fetch(`/api/recording/sessions/${sessionId}/takes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'start', startAtHostMs }),
    })
    const takeJson = await takeRes.json()
    const takeId = takeJson.data?.takeId as string
    takeIdRef.current = takeId

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

    const stream = await ensureStream()
    setRecording(true)
    recStartRef.current = Date.now()
    setRecSeconds(0)
    const actualStartHostMs = Date.now()
    recordersRef.current = []

    const videoTrack = stream.getVideoTracks()[0]
    const audioTrack = stream.getAudioTracks()[0]

    async function registerAndRecord(kind: 'CAMERA' | 'MICROPHONE', track: MediaStreamTrack) {
      const trackId = createId('rtrk')
      const vs = new MediaStream([track])
      await fetch('/api/recording/tracks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          takeId,
          trackId,
          participantId,
          kind,
          mimeType: kind === 'CAMERA' ? 'video/webm' : 'audio/webm',
          actualStartHostMs,
        }),
      })
      const handle = startLocalTrackRecorder({
        sessionId,
        takeId,
        trackId,
        kind,
        stream: vs,
        onChunk: () => uploadMgr.current?.pump(trackId),
      })
      recordersRef.current.push(handle)
      await uploadMgr.current?.registerTrack({
        trackId,
        sessionId,
        takeId,
        mimeType: handle.mimeType,
        kind,
        participantId,
        displayName: 'You',
        actualStartHostMs,
        clockOffsetMs: 0,
      })
    }

    if (videoTrack) await registerAndRecord('CAMERA', videoTrack)
    if (audioTrack) await registerAndRecord('MICROPHONE', audioTrack)
  }, [countdownEnabled, ensureEditorSession, ensureStream])

  const stopRecording = useCallback(async () => {
    const sessionId = sessionIdRef.current
    const takeId = takeIdRef.current
    setRecording(false)
    for (const r of recordersRef.current) await r.stop()
    recordersRef.current = []
    if (sessionId && takeId) {
      const stopAtHostMs = Date.now()
      await fetch(`/api/recording/sessions/${sessionId}/takes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'stop', takeId, stopAtHostMs }),
      })
      const metas = await import('@/lib/recording/chunk-store').then((m) =>
        m.listTrackMetaForSession(sessionId),
      )
      for (const meta of metas.filter((m) => m.takeId === takeId)) {
        await uploadMgr.current?.pump(meta.trackId, true)
      }
      const importRes = await fetch(`/api/recording/sessions/${sessionId}/takes/${takeId}/import`, {
        method: 'POST',
      })
      const importJson = (await importRes.json()) as {
        data?: RecordingImportResult
        error?: string
      }
      if (!importRes.ok) throw new Error(importJson.error ?? 'Import failed')
      if (importJson.data) onImportRef.current?.(importJson.data)
      return importJson.data
    }
    return undefined
  }, [])

  const disarm = useCallback(() => {
    void stopRecording()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setArmed(false)
  }, [stopRecording])

  return {
    armed,
    setArmed,
    recording,
    countdown,
    recSeconds,
    uploadRows,
    cameras,
    mics,
    cameraId,
    setCameraId,
    micId,
    setMicId,
    countdownEnabled,
    setCountdownEnabled,
    startRecording,
    stopRecording,
    disarm,
  }
}
