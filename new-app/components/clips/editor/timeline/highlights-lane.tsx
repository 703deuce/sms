'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { HighlightPick, HighlightRange } from '@/lib/clips/editor/highlights'
import { clampPickDrag, isPickMoved } from '@/lib/clips/editor/highlights'
import { reasonTagLabel } from '@/lib/clips/reason-tag'

export type HighlightsLaneProps = {
  durationMs: number
  pxPerMs: number
  offsetPx: number
  ranges: HighlightRange[]
  selectedClipId: string | null
  onSelect: (clipId: string) => void
  onRangeChange: (clipId: string, range: { startMs: number; endMs: number }) => void
  onMakeClip: (pick: HighlightPick, range: HighlightRange) => void
  onOpenCard: (pick: HighlightPick) => void
  jobRunning?: boolean
  progress?: number | null
  onSelectPrev?: () => void
  onSelectNext?: () => void
  filmstripUrl?: string | null
}

export function HighlightsLane({
  durationMs,
  pxPerMs,
  offsetPx,
  ranges,
  selectedClipId,
  onSelect,
  onRangeChange,
  onMakeClip,
  onOpenCard,
  jobRunning,
  progress,
  onSelectPrev,
  onSelectNext,
}: HighlightsLaneProps) {
  const xs = (ms: number) => offsetPx + ms * pxPerMs
  const selectedIndex = useMemo(
    () => ranges.findIndex((r) => r.pick.clipId === selectedClipId),
    [ranges, selectedClipId],
  )

  if (jobRunning && !ranges.length) {
    const pct = typeof progress === 'number' ? Math.round(progress) : null
    return (
      <div
        className="relative flex h-9 items-center border-b border-primary/20 bg-[repeating-linear-gradient(45deg,hsl(var(--primary)/0.08)_0,hsl(var(--primary)/0.08)_8px,transparent_8px,transparent_16px)] px-3 text-[11px] text-muted-foreground"
        data-testid="highlights-lane"
      >
        <span data-testid="highlights-finding-label">
          Finding clips…{pct != null ? ` ${pct}%` : ''}
        </span>
      </div>
    )
  }

  if (!jobRunning && !ranges.length) {
    return (
      <div className="relative flex h-9 items-center border-b border-border px-3 text-[11px] text-muted-foreground" data-testid="highlights-lane">
        No strong moments found
      </div>
    )
  }

  return (
    <div className="relative h-9 border-b border-primary/20 bg-primary/5" data-testid="highlights-lane">
      {ranges.map((r) => {
        const left = xs(r.startMs)
        const w = Math.max(4, xs(r.endMs) - left)
        const selected = r.pick.clipId === selectedClipId
        return (
          <div
            key={r.pick.clipId}
            data-testid="highlight-range"
            className={`absolute top-1 h-7 rounded-sm border text-[11px] leading-7 text-white shadow-sm ${
              selected ? 'border-white bg-primary/80' : 'border-primary/40 bg-primary/50'
            }`}
            style={{ left, width: w }}
            onClick={() => onSelect(r.pick.clipId)}
            role="button"
            tabIndex={0}
          >
            <span className="pointer-events-none flex items-center gap-0.5 truncate px-1">
              <span className="rounded bg-black/30 px-0.5 text-[11px]">{reasonTagLabel(r.pick.reasonTag).slice(0, 1)}</span>
              {r.pick.title} · {r.pick.score}
            </span>
            <button
              type="button"
              data-testid="highlight-edge-start"
              className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize bg-white/40"
              onPointerDown={(e) => {
                e.stopPropagation()
                const x0 = e.clientX
                const start0 = r.startMs
                const move = (ev: PointerEvent) => {
                  const next = clampPickDrag(
                    { startMs: start0, endMs: r.endMs },
                    'start',
                    start0 + (ev.clientX - x0) / pxPerMs,
                    durationMs,
                  )
                  onRangeChange(r.pick.clipId, next)
                }
                const up = () => {
                  window.removeEventListener('pointermove', move)
                  window.removeEventListener('pointerup', up)
                }
                window.addEventListener('pointermove', move)
                window.addEventListener('pointerup', up)
              }}
            />
            <button
              type="button"
              data-testid="highlight-edge-end"
              className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize bg-white/40"
              onPointerDown={(e) => {
                e.stopPropagation()
                const x0 = e.clientX
                const end0 = r.endMs
                const move = (ev: PointerEvent) => {
                  const next = clampPickDrag(
                    { startMs: r.startMs, endMs: end0 },
                    'end',
                    end0 + (ev.clientX - x0) / pxPerMs,
                    durationMs,
                  )
                  onRangeChange(r.pick.clipId, next)
                }
                const up = () => {
                  window.removeEventListener('pointermove', move)
                  window.removeEventListener('pointerup', up)
                }
                window.addEventListener('pointermove', move)
                window.addEventListener('pointerup', up)
              }}
            />
            {selected ? (
              <div
                data-testid="highlight-popover"
                className="absolute left-0 top-full z-20 mt-1 min-w-[180px] rounded-md border border-border bg-popover p-2 text-[11px] text-foreground shadow-md"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="line-clamp-2 text-muted-foreground">{r.pick.why || r.pick.title}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <button
                    type="button"
                    data-testid="highlight-make-clip"
                    className="rounded bg-primary px-2 py-0.5 text-primary-foreground"
                    onClick={() => onMakeClip(r.pick, r)}
                  >
                    Make clip
                  </button>
                  {r.pick.origin !== 'find' ? (
                    <button
                      type="button"
                      className="rounded border border-border px-2 py-0.5"
                      onClick={() => onOpenCard(r.pick)}
                    >
                      Open card
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        )
      })}
      {ranges.length ? (
        <div className="absolute right-2 top-1.5 flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
          <button type="button" aria-label="Previous highlight" className="rounded p-0.5 hover:bg-muted" onClick={() => onSelectPrev?.()} data-testid="highlights-prev">
            <ChevronLeft className="size-3.5" />
          </button>
          <span>
            {selectedIndex >= 0 ? selectedIndex + 1 : 0}/{ranges.length}
          </span>
          <button type="button" aria-label="Next highlight" className="rounded p-0.5 hover:bg-muted" onClick={() => onSelectNext?.()} data-testid="highlights-next">
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  )
}

export { isPickMoved }
