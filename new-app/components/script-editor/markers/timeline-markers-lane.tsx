'use client'

import { useRef } from 'react'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'

export function TimelineMarkersLane({
  document,
  widthPx,
  pxPerMs,
  onSeek,
  onMoveMarker,
}: {
  document: ScriptDocumentV1
  widthPx: number
  pxPerMs: number
  onSeek: (outMs: number) => void
  onMoveMarker?: (id: string, outMs: number) => void
}) {
  const markers = document.markers ?? []
  const dragRef = useRef<{ id: string; startX: number; startMs: number } | null>(null)

  const onPointerDown = (id: string, outMs: number, e: React.PointerEvent) => {
    if (!onMoveMarker) return
    e.preventDefault()
    dragRef.current = { id, startX: e.clientX, startMs: outMs }
    let latestMs = outMs
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const deltaMs = (ev.clientX - d.startX) / pxPerMs
      latestMs = Math.max(0, Math.round(d.startMs + deltaMs))
    }
    const onUp = () => {
      const d = dragRef.current
      if (d) onMoveMarker(d.id, latestMs)
      dragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div className="relative h-7 border-b border-border/40" style={{ width: widthPx }} data-testid="timeline-markers-lane">
      {markers.map((m) => (
        <button
          key={m.id}
          type="button"
          className="absolute top-0 z-10 -translate-x-1/2 cursor-grab active:cursor-grabbing"
          style={{ left: m.outMs * pxPerMs }}
          title={m.label ?? 'Marker'}
          onClick={() => onSeek(m.outMs)}
          onPointerDown={(e) => onPointerDown(m.id, m.outMs, e)}
        >
          <span className="block h-2.5 w-2 bg-primary shadow-sm" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }} />
          <span className="absolute left-1/2 top-2 h-full w-px -translate-x-1/2 bg-primary/60" />
        </button>
      ))}
    </div>
  )
}
