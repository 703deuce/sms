'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { startLocalTrackRecorder } from '@/lib/recording/local-track-recorder'
import type { TrackUploadProgress } from '@/lib/recording/track-upload-manager'
import { listChunksForTrack } from '@/lib/recording/chunk-store'
import { createId } from '@/lib/supabase/id'
import { listMediaDeviceOptions } from '@/lib/recording/livekit-devices'

export function useEditorRecorder(projectId: string) {
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
  const takeIdRef = useRef<string | null>(null)
  const trackIdsRef = useRef<string[]>([])
  const recStartRef = useRef<number | null>(null)

  useEffect(() => {
    void listMediaDeviceOptions('videoinput').then(setCameras)
    void listMediaDeviceOptions('audioinput').then(setMics)
  }, [projectId])

  const refreshUploadRows = useCallback(async () => {
    const rows: TrackUploadProgress[] = []
    for (const trackId of trackIdsRef.current) {
      const chunks = await listChunksForTrack(trackId)
      const bytes = chunks.reduce((a, c) => a + c.blob.size, 0)
      const percent = Math.min(99, Math.round((bytes / (8 * 1024 * 1024)) * 100))
      rows.push({
        trackId,
        participantId: 'local-editor',
        label: trackId.includes('mic') ? 'Microphone · You' : 'Camera · You',
        percent,
        stalled: false,
        done: false,
      })
    }
    setUploadRows(rows)
  }, [])

  useEffect(() => {
    if (!recording) return
    const id = window.setInterval(() => {
      if (recStartRef.current) setRecSeconds(Math.floor((Date.now() - recStartRef.current) / 1000))
    }, 400)
    return () => window.clearInterval(id)
  }, [recording])

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
    const takeId = createId('rtake')
    takeIdRef.current = takeId
    const run = async () => {
      const stream = await ensureStream()
      setRecording(true)
      recStartRef.current = Date.now()
      setRecSeconds(0)
      const videoTrack = stream.getVideoTracks()[0]
      const audioTrack = stream.getAudioTracks()[0]
      recordersRef.current = []
      const startMs = Date.now()
      if (videoTrack) {
        const trackId = createId('rtrk')
        const vs = new MediaStream([videoTrack])
        const handle = startLocalTrackRecorder({
          sessionId: projectId,
          takeId,
          trackId,
          kind: 'CAMERA',
          stream: vs,
          onChunk: () => void refreshUploadRows(),
        })
        recordersRef.current.push(handle)
        trackIdsRef.current.push(trackId)
      }
      if (audioTrack) {
        const trackId = createId('rtrk')
        const vs = new MediaStream([audioTrack])
        const handle = startLocalTrackRecorder({
          sessionId: projectId,
          takeId,
          trackId,
          kind: 'MICROPHONE',
          stream: vs,
          onChunk: () => void refreshUploadRows(),
        })
        recordersRef.current.push(handle)
        trackIdsRef.current.push(trackId)
      }
      await refreshUploadRows()
    }
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
    await run()
  }, [countdownEnabled, ensureStream, projectId, refreshUploadRows])

  const stopRecording = useCallback(async () => {
    setRecording(false)
    for (const r of recordersRef.current) await r.stop()
    recordersRef.current = []
    setUploadRows((rows) => rows.map((r) => ({ ...r, percent: 100, done: true })))
    trackIdsRef.current = []
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
