'use client'

import { useEffect, useState } from 'react'
import { fetchCallRecordingUrl } from '@/lib/phone-api'
import { formatDuration } from '@/lib/format'

export function CallRecordingPlayer({
  callId,
  durationSec,
}: {
  callId: string
  durationSec: number
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [callId])

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

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {formatDuration(durationSec)} call recording
      </p>
      <audio
        controls
        playsInline
        preload="metadata"
        src={url}
        className="w-full max-w-md"
        aria-label="Call recording playback"
      />
      <a
        href={url}
        download
        className="text-sm font-medium text-primary underline-offset-2 hover:underline"
      >
        Download recording
      </a>
    </div>
  )
}
