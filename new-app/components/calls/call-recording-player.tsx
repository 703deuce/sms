'use client'

import { useEffect, useState } from 'react'
import { fetchCallRecordingUrl } from '@/lib/phone-api'
import { formatDuration } from '@/lib/format'

export function CallRecordingPlayer({
  callId,
  durationSec,
  recordingUrl: serverRecordingUrl,
}: {
  callId: string
  durationSec: number
  /** When present (SSR), skip client fetch — avoids stuck loading on effect cleanup races. */
  recordingUrl?: string | null
}) {
  const [url, setUrl] = useState<string | null>(serverRecordingUrl ?? null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!serverRecordingUrl)

  useEffect(() => {
    if (serverRecordingUrl) {
      setUrl(serverRecordingUrl)
      setLoading(false)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const recordingUrl = await fetchCallRecordingUrl(callId)
        if (!cancelled) setUrl(recordingUrl)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not load recording')
        }
      } finally {
        // Always clear loading — otherwise Strict Mode / remount leaves "Loading…" forever.
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [callId, serverRecordingUrl])

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading recording…</p>
  }

  if (error || !url) {
    return (
      <p className="text-sm leading-relaxed text-muted-foreground">
        {error || 'Recording is not available yet. Try again in a minute or contact support if this persists.'}
      </p>
    )
  }

  const playbackSrc = `/api/phone/calls/${encodeURIComponent(callId)}/recording/stream`

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {formatDuration(durationSec)} call recording
      </p>
      <audio
        controls
        playsInline
        preload="metadata"
        src={playbackSrc}
        className="w-full max-w-md"
        aria-label="Call recording playback"
      />
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
