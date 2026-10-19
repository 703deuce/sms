'use client'

import { useEffect, useState } from 'react'
import { formatDuration } from '@/lib/format'

export function CallRecordingPlayer({
  callId,
  durationSec,
}: {
  callId: string
  durationSec: number
}) {
  const playbackSrc = `/api/phone/calls/${encodeURIComponent(callId)}/recording/stream`
  const [ready, setReady] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setReady(false)
    setAudioError(null)
    void (async () => {
      try {
        const res = await fetch(playbackSrc, { method: 'HEAD', credentials: 'include' })
        if (cancelled) return
        if (!res.ok) {
          let detail = `HTTP ${res.status}`
          try {
            const json = await res.json()
            if (json.error) detail = String(json.error)
          } catch {
            /* stream may not be json */
          }
          setAudioError(detail)
          return
        }
        setReady(true)
      } catch (e) {
        if (!cancelled) setAudioError(e instanceof Error ? e.message : 'Playback check failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [playbackSrc])

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {formatDuration(durationSec)} call recording
      </p>
      {audioError ? (
        <p className="text-sm text-destructive">
          Playback failed ({audioError}). Try Download below, or refresh after a minute if the recording was just saved.
        </p>
      ) : !ready ? (
        <p className="text-sm text-muted-foreground">Preparing playback…</p>
      ) : null}
      {ready && !audioError ? (
        <audio
          controls
          playsInline
          preload="metadata"
          src={playbackSrc}
          className="w-full max-w-md"
          aria-label="Call recording playback"
          onError={() => setAudioError('Audio element could not decode stream')}
        />
      ) : null}
      <a
        href={playbackSrc}
        download={`call-${callId}.mp3`}
        className="text-sm font-medium text-primary underline-offset-2 hover:underline"
      >
        Download recording
      </a>
    </div>
  )
}
