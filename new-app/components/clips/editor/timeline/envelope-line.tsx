'use client'

import { useRef, useState } from 'react'
import type { KeyPoint } from '@/lib/clips/editor/motion-schema'
import { valueAtPoints } from '@/lib/clips/editor/keyframes'

/**
 * G1b: one item's envelope (Vegas rubber band) drawn over the timeline item. Click the line to add a
 * point, drag a point (time + value), double-click a point to delete it. Times are the target's
 * LOCAL ms; `fromLocalMs` = local time at the item's left edge.
 */
export function EnvelopeLine({
  points,
  flat,
  min,
  max,
  widthPx,
  heightPx,
  pxPerMs,
  fromLocalMs,
  kind,
  readOnly,
  onAdd,
  onMove,
  onDelete,
}: {
  points: KeyPoint[]
  flat: number
  min: number
  max: number
  widthPx: number
  heightPx: number
  pxPerMs: number
  fromLocalMs: number
  kind: 'opacity' | 'volume'
  readOnly?: boolean
  onAdd: (localMs: number) => void
  onMove: (fromMs: number, toMs: number, v: number) => void
  onDelete: (tMs: number) => void
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [live, setLive] = useState<{ from: number; t: number; v: number } | null>(null)
  const pts = live ? points.map((p) => (p.tMs === live.from ? { ...p, tMs: live.t, v: live.v } : p)) : points
  const pad = 3
  const yOf = (v: number) => pad + (1 - (v - min) / Math.max(1e-6, max - min)) * (heightPx - 2 * pad)
  const vOf = (y: number) => min + (1 - (y - pad) / Math.max(1, heightPx - 2 * pad)) * (max - min)
  const xOf = (t: number) => (t - fromLocalMs) * pxPerMs
  const toLocal = (x: number) => fromLocalMs + x / Math.max(1e-6, pxPerMs)
  const def = pts.length ? pts[0]!.v : flat
  // Sample at every point inside the item + both edges (linear between points draws exactly).
  const ts = [fromLocalMs, ...pts.map((p) => p.tMs).filter((t) => t > fromLocalMs && t < toLocal(widthPx)), toLocal(widthPx)]
  const line = ts.map((t) => `${xOf(t).toFixed(1)},${yOf(pts.length ? valueAtPoints(pts, t, def) : flat).toFixed(1)}`).join(' ')
  const local = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect()
    return { t: toLocal(e.clientX - r.left), v: vOf(e.clientY - r.top) }
  }
  const color = kind === 'volume' ? 'stroke-emerald-200' : 'stroke-yellow-300'
  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 z-[11] overflow-visible"
      width={widthPx}
      height={heightPx}
      data-testid="timeline-envelope"
      data-kind={kind}
      aria-label={`${kind === 'volume' ? 'Volume' : 'Opacity'} envelope`}
    >
      <polyline
        points={line}
        className={`fill-none ${color}`}
        strokeWidth={1.5}
        data-testid="timeline-envelope-line"
        style={{ pointerEvents: 'none' }}
      />
      {/* Wide invisible hit line: click adds a point. */}
      <polyline
        points={line}
        className="fill-none stroke-transparent"
        strokeWidth={9}
        style={{ cursor: readOnly ? 'default' : 'copy', pointerEvents: readOnly ? 'none' : 'stroke' }}
        data-testid="timeline-envelope-hit"
        onPointerDown={(e) => {
          e.stopPropagation()
          if (e.button !== 0 || readOnly) return
          onAdd(local(e).t)
        }}
      />
      {pts.map((p) => (
        <circle
          key={p.tMs}
          cx={xOf(p.tMs)}
          cy={yOf(p.v)}
          r={3.5}
          className={`fill-white ${color}`}
          strokeWidth={1.5}
          style={{ cursor: readOnly ? 'default' : 'move' }}
          data-testid="timeline-envelope-point"
          data-t-ms={Math.round(p.tMs)}
          data-v={Math.round(p.v)}
          onDoubleClick={(e) => {
            e.stopPropagation()
            if (!readOnly) onDelete(p.tMs)
          }}
          onPointerDown={(e) => {
            e.stopPropagation()
            if (e.button !== 0 || readOnly) return
            const from = p.tMs
            let cur = { from, t: p.tMs, v: p.v }
            let moved = false
            const mv = (ev: PointerEvent) => {
              const l = local(ev)
              moved = true
              cur = { from, t: Math.round(l.t), v: Math.round(Math.min(max, Math.max(min, l.v))) }
              setLive(cur)
            }
            const up = () => {
              window.removeEventListener('pointermove', mv)
              window.removeEventListener('pointerup', up)
              setLive(null)
              if (moved) onMove(from, cur.t, cur.v)
            }
            window.addEventListener('pointermove', mv)
            window.addEventListener('pointerup', up)
          }}
        >
          <title>{`${Math.round(p.v)} % — drag to move, double-click to delete`}</title>
        </circle>
      ))}
    </svg>
  )
}
