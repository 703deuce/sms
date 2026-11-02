'use client'

import type { ExportTimeMap } from '@/lib/clips/editor/export-time'
import { sourceById, type ClipMediaSource } from '@/lib/clips/editor/sources'

/**
 * E5b → TC2: inserted clips on the Video lane, drawn in EXPORT time. Each insert is a block as long
 * as the time it adds (gap = black, freeze = hatched, clip = violet); items after it sit to its
 * right, where they play in the export. The label names what was inserted and its length.
 */
export function TimelineInsertMarkers({
  tmap,
  sources,
  pxPerMs,
}: {
  tmap: ExportTimeMap
  sources: ClipMediaSource[] | undefined
  pxPerMs: number
}) {
  if (!tmap.wins.length) return null
  return (
    <>
      {tmap.wins.map((w) => {
        const label = w.freeze ? 'Freeze frame' : w.gap ? 'Gap' : sourceById(sources, w.sourceId)?.label ?? 'Clip'
        const width = Math.max(3, w.durMs * pxPerMs)
        return (
          <div
            key={`ins${w.id}`}
            className={`pointer-events-none absolute inset-y-0 z-[17] flex items-start overflow-hidden rounded-sm border ${
              w.gap ? 'border-zinc-500 bg-black' : w.freeze ? 'border-sky-400 bg-sky-900/80' : 'border-violet-400 bg-violet-700/80'
            }`}
            style={{ left: w.startMs * pxPerMs, width }}
            title={`Inserted: ${label} (+${(w.durMs / 1000).toFixed(1)} s) — adjust under Media → Inserted clips`}
            data-testid="timeline-insert-marker"
            data-gap={w.gap ? 'true' : undefined}
            data-export-start-ms={w.startMs}
            data-dur-ms={w.durMs}
          >
            <span className="m-0.5 whitespace-nowrap rounded-sm bg-violet-600 px-1 text-[11px] leading-[12px] text-white shadow" data-testid="timeline-insert-label">
              {label} +{(w.durMs / 1000).toFixed(1)}s
            </span>
          </div>
        )
      })}
    </>
  )
}
