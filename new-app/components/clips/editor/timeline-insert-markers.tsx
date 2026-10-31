'use client'

import { useMemo } from 'react'
import { insertWindows, type ClipInsert } from '@/lib/clips/editor/inserts'
import { sourceById, type ClipMediaSource } from '@/lib/clips/editor/sources'

/**
 * E5b: where inserted clips play, on the Video lane (edit timeline). Each marker shows the length
 * the insert adds (the video is that much longer; content to the right plays after it).
 */
export function TimelineInsertMarkers({
  tb,
  inserts,
  sources,
  pxPerMs,
}: {
  tb: { segs: [number, number][] }
  inserts: ClipInsert[] | undefined
  sources: ClipMediaSource[] | undefined
  pxPerMs: number
}) {
  const wins = useMemo(() => insertWindows(tb.segs, inserts), [tb, inserts])
  if (!wins.length) return null
  // Several inserts at one point share one marker.
  const groups = new Map<number, typeof wins>()
  for (const w of wins) groups.set(w.baseMs, [...(groups.get(w.baseMs) ?? []), w])
  return (
    <>
      {[...groups.entries()].map(([baseMs, ws]) => {
        const addMs = ws.reduce((s, w) => s + w.durMs, 0)
        const labels = ws.map((w) => (w.freeze ? 'Freeze frame' : sourceById(sources, w.sourceId)?.label ?? 'Clip')).join(', ')
        return (
          <div
            key={`ins${baseMs}`}
            className="pointer-events-none absolute top-0 z-[17] flex h-full -translate-x-1/2 flex-col items-center"
            style={{ left: baseMs * pxPerMs }}
            title={`Inserted: ${labels} (+${(addMs / 1000).toFixed(1)} s)`}
            data-testid="timeline-insert-marker"
          >
            <span className="rounded-sm bg-violet-600 px-1 text-[9px] leading-[12px] text-white shadow">+{(addMs / 1000).toFixed(1)}s</span>
            <span className="w-0.5 flex-1 bg-violet-500" />
          </div>
        )
      })}
    </>
  )
}
