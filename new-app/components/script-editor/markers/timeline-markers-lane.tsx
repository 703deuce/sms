'use client'

import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'

export function TimelineMarkersLane({
  document,
  widthPx,
  pxPerMs,
  onSeek,
}: {
  document: ScriptDocumentV1
  widthPx: number
  pxPerMs: number
  onSeek: (outMs: number) => void
}) {
  const markers = document.markers ?? []
  return (
    <div className="relative h-7 border-b border-border/40" style={{ width: widthPx }} data-testid="timeline-markers-lane">
      {markers.map((m) => (
        <button
          key={m.id}
          type="button"
          className="absolute top-0 z-10 -translate-x-1/2"
          style={{ left: m.outMs * pxPerMs }}
          title={m.label ?? 'Marker'}
          onClick={() => onSeek(m.outMs)}
        >
          <span className="block h-2.5 w-2 bg-primary" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }} />
          <span className="absolute left-1/2 top-2 h-full w-px -translate-x-1/2 bg-primary/60" />
        </button>
      ))}
    </div>
  )
}
