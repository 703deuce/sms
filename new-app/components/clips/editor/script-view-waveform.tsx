'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { AudioPeaks } from '@/components/clips/editor/use-audio-peaks'
import { TimelineWaveform } from '@/components/clips/editor/timeline/timeline-waveform'

/** Script view bottom strip: full-clip voice waveform with cut shading. */
export function ScriptViewWaveform({
  peaks,
  edits,
  trimInMs,
  trimOutMs,
  mediaOffsetMs,
  outputDurationMs,
  outputMs,
  onSeekOutput,
}: {
  peaks: AudioPeaks
  edits: ClipEditsV2
  trimInMs: number
  trimOutMs: number
  mediaOffsetMs: number
  outputDurationMs: number
  outputMs: number
  onSeekOutput: (ms: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [widthPx, setWidthPx] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidthPx(Math.max(1, Math.floor(el.clientWidth))))
    ro.observe(el)
    setWidthPx(Math.max(1, Math.floor(el.clientWidth)))
    return () => ro.disconnect()
  }, [])

  const trimSpan = Math.max(1, trimOutMs - trimInMs)
  const mediaFromMs = trimInMs - mediaOffsetMs
  const mediaToMs = trimOutMs - mediaOffsetMs

  const cutBands = (edits.cutRanges ?? [])
    .map((cr) => {
      const a = Math.max(trimInMs, cr.startMs)
      const b = Math.min(trimOutMs, cr.endMs)
      if (b <= a) return null
      return {
        leftPct: ((a - trimInMs) / trimSpan) * 100,
        widthPct: ((b - a) / trimSpan) * 100,
      }
    })
    .filter(Boolean) as { leftPct: number; widthPct: number }[]

  return (
    <div
      ref={ref}
      className="relative h-full min-h-10 w-full cursor-pointer"
      data-testid="script-view-waveform"
      role="presentation"
      onClick={(e) => {
        if (outputDurationMs <= 0) return
        const rect = e.currentTarget.getBoundingClientRect()
        const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
        onSeekOutput(Math.round(x * outputDurationMs))
      }}
    >
      {widthPx > 0 ? (
        <TimelineWaveform
          peaks={peaks}
          mediaFromMs={mediaFromMs}
          mediaToMs={mediaToMs}
          widthPx={widthPx}
          className="absolute inset-0 size-full text-primary/70"
        />
      ) : null}
      {cutBands.map((b, i) => (
        <div
          key={i}
          className="pointer-events-none absolute inset-y-0 bg-destructive/25"
          style={{ left: `${b.leftPct}%`, width: `${b.widthPct}%` }}
          data-testid="script-view-cut-shade"
        />
      ))}
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary shadow-sm"
        style={{ left: outputDurationMs > 0 ? `${(outputMs / outputDurationMs) * 100}%` : '0%' }}
        data-testid="script-view-wave-playhead"
      />
    </div>
  )
}
