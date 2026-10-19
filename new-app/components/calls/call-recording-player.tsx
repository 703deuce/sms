'use client'

import { useState } from 'react'
import { formatDuration } from '@/lib/format'

export function CallRecordingPlayer({
  callId,
  durationSec,
}: {
  callId: string
  durationSec: number
}) {
  const [audioError, setAudioError] = useState(false)
  const playbackSrc = `/api/phone/calls/${encodeURIComponent(callId)}/recording/stream`

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {formatDuration(durationSec)} call recording
      </p>
      {audioError ? (
        <p className="text-sm text-muted-foreground">
          Playback failed. Try Download recording below, or refresh in a moment.
        </p>
      ) : null}
      <audio
        controls
        playsInline
        preload="metadata"
        src={playbackSrc}
        className="w-full max-w-md"
        aria-label="Call recording playback"
        onError={() => setAudioError(true)}
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
