'use client'

import { cn } from '@/lib/utils'
import type { TimelineClip } from '@/lib/clips/script-editor/timeline-model'
import { AudioWaveformLane } from '@/components/clips/editor/audio-waveform-lane'

export function TimelineScriptTrack({
  clips,
  pxPerMs,
  widthPx,
  durationMs,
  videoUrl,
  selectionOutRange,
  onSelectOutputRange,
  onTrimClipEdge,
}: {
  clips: TimelineClip[]
  pxPerMs: number
  widthPx: number
  durationMs: number
  videoUrl: string | null
  selectionOutRange: { lo: number; hi: number } | null
  onSelectOutputRange: (lo: number, hi: number) => void
  onTrimClipEdge?: (clipKey: string, edge: 'start' | 'end', deltaOutMs: number) => void
}) {
  const dragSelect = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const track = e.currentTarget as HTMLElement
    const rect = track.getBoundingClientRect()
    const x0 = e.clientX - rect.left
    const startOut = (x0 / pxPerMs)
    const onMove = (ev: PointerEvent) => {
      const x1 = ev.clientX - rect.left
      const endOut = x1 / pxPerMs
      onSelectOutputRange(Math.max(0, startOut), Math.max(0, endOut))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      className="relative min-h-[64px] flex-1 rounded-b-md bg-muted/30"
      style={{ width: widthPx, minHeight: 64 }}
      onPointerDown={dragSelect}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 overflow-hidden opacity-80">
        {clips
          .filter((c) => c.kind === 'source')
          .map((clip) => (
            <div
              key={clip.key}
              className="absolute top-1 h-[calc(100%-4px)] rounded-sm bg-gradient-to-b from-neutral-600/50 to-neutral-800/40"
              style={{
                left: clip.outStartMs * pxPerMs,
                width: Math.max(4, (clip.outEndMs - clip.outStartMs) * pxPerMs),
              }}
            />
          ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 overflow-hidden rounded-b-md">
        <AudioWaveformLane videoUrl={videoUrl} className="absolute inset-0 size-full text-emerald-400/70" />
      </div>
      {clips.map((clip) => {
        const left = clip.outStartMs * pxPerMs
        const w = Math.max(4, (clip.outEndMs - clip.outStartMs) * pxPerMs)
        const inSel =
          selectionOutRange &&
          clip.outEndMs >= selectionOutRange.lo &&
          clip.outStartMs <= selectionOutRange.hi
        return (
          <div
            key={clip.key}
            className={cn(
              'absolute top-0 bottom-0 rounded border border-transparent',
              clip.kind === 'gap' ? 'bg-amber-500/10' : 'bg-transparent',
              inSel && 'border-sky-400/80 bg-sky-500/10',
            )}
            style={{ left, width: w }}
          >
            {clip.kind === 'source' && onTrimClipEdge && (
              <>
                <div
                  className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-primary/0 hover:bg-primary/40"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    trimDrag(e, clip.key, 'start', pxPerMs, onTrimClipEdge)
                  }}
                />
                <div
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-primary/0 hover:bg-primary/40"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    trimDrag(e, clip.key, 'end', pxPerMs, onTrimClipEdge)
                  }}
                />
              </>
            )}
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500/80" aria-hidden />
          </div>
        )
      })}
      {selectionOutRange && (
        <div
          className="pointer-events-none absolute top-0 bottom-0 border border-sky-400/60 bg-sky-400/10"
          style={{
            left: selectionOutRange.lo * pxPerMs,
            width: Math.max(2, (selectionOutRange.hi - selectionOutRange.lo) * pxPerMs),
          }}
        />
      )}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ width: Math.max(widthPx, durationMs * pxPerMs) }}
      />
    </div>
  )
}

function trimDrag(
  e: React.PointerEvent,
  clipKey: string,
  edge: 'start' | 'end',
  pxPerMs: number,
  onTrim: (clipKey: string, edge: 'start' | 'end', deltaOutMs: number) => void,
) {
  e.preventDefault()
  const startX = e.clientX
  const onMove = (ev: PointerEvent) => {
    const deltaMs = (ev.clientX - startX) / pxPerMs
    if (Math.abs(deltaMs) > 8) onTrim(clipKey, edge, deltaMs)
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}
