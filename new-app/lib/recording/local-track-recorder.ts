'use client'

import { RECORDING_CHUNK_TIMESLICE_MS } from '@/lib/recording/coalesce-parts'
import { pickRecorderMime, videoBitsPerSecond, audioBitsPerSecond } from '@/lib/recording/mime'
import { putChunk, type StoredChunk } from '@/lib/recording/chunk-store'
import { createId } from '@/lib/supabase/id'

export type LocalRecorderHandle = {
  trackId: string
  kind: 'CAMERA' | 'MICROPHONE' | 'SCREEN' | 'SCREEN_AUDIO'
  mimeType: string
  stop: () => Promise<void>
}

export function startLocalTrackRecorder(input: {
  sessionId: string
  takeId: string
  trackId: string
  kind: LocalRecorderHandle['kind']
  stream: MediaStream
  onChunk?: () => void
}): LocalRecorderHandle {
  const isVideo = input.kind === 'CAMERA' || input.kind === 'SCREEN'
  const mimeType = pickRecorderMime(isVideo ? 'video' : 'audio')
  if (!mimeType) throw new Error('No supported MediaRecorder mime type')
  let seq = 0
  const recorder = new MediaRecorder(input.stream, {
    mimeType,
    videoBitsPerSecond: isVideo ? videoBitsPerSecond() : undefined,
    audioBitsPerSecond: !isVideo ? audioBitsPerSecond() : undefined,
  })
  recorder.ondataavailable = async (ev) => {
    if (!ev.data.size) return
    const chunk: StoredChunk = {
      id: createId('chk'),
      sessionId: input.sessionId,
      takeId: input.takeId,
      trackId: input.trackId,
      seq: seq++,
      blob: ev.data,
      createdAt: Date.now(),
    }
    await putChunk(chunk)
    input.onChunk?.()
  }
  recorder.start(RECORDING_CHUNK_TIMESLICE_MS)
  return {
    trackId: input.trackId,
    kind: input.kind,
    mimeType,
    stop: async () => {
      if (recorder.state !== 'inactive') {
        recorder.stop()
        await new Promise<void>((r) => {
          recorder.onstop = () => r()
        })
      }
      input.stream.getTracks().forEach((t) => t.stop())
    },
  }
}
