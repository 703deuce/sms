'use client'

import { slicePeaks, type AudioPeaks } from '@/components/clips/editor/use-audio-peaks'

/** Waveform for one lane item: media range [mediaFromMs, mediaToMs) drawn into widthPx. */
export function TimelineWaveform({
  peaks,
  mediaFromMs,
  mediaToMs,
  widthPx,
  className,
}: {
  peaks: AudioPeaks
  mediaFromMs: number
  mediaToMs: number
  widthPx: number
  className?: string
}) {
  const bars = Math.max(1, Math.min(600, Math.floor(widthPx / 3)))
  const vals = slicePeaks(peaks, mediaFromMs, mediaToMs, bars)
  if (!vals.length) return null
  return (
    <svg
      className={className}
      viewBox={`0 0 ${vals.length} 20`}
      preserveAspectRatio="none"
      aria-hidden
      data-testid="timeline-waveform"
    >
      {vals.map((p, i) => (
        <rect key={i} x={i} y={10 - p * 9} width={0.7} height={p * 18 + 0.5} fill="currentColor" />
      ))}
    </svg>
  )
}
