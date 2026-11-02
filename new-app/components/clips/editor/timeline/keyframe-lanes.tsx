'use client'

import { useState } from 'react'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { findTrack, moveTrackPoint, type KeyProp, type KeyframeTarget } from '@/lib/clips/editor/keyframes'
import { PROP_SPECS } from '@/lib/clips/editor/motion-schema'
import { keyframeLaneFraction, keyframeLocalEditFromLaneFraction } from '@/lib/clips/editor/keyframe-time'

const DRAG_SLOP = 3
const FRAME_MS = 1000 / 30

/** KF-19: one lane per animated property of the inspected item (item-local time). */
export function KeyframeLanes({
  edits,
  target,
  props,
  span,
  localMs,
  originMs,
  onCommit,
  onSeekLocal,
  readOnly,
}: {
  edits: ClipEditsV2
  target: KeyframeTarget
  props: readonly KeyProp[]
  span: { fromMs: number; toMs: number }
  localMs: number
  /** Target origin (absolute edit ms of local 0). */
  originMs: number
  onCommit: (next: ClipEditsV2) => void
  onSeekLocal: (localMs: number) => void
  readOnly: boolean
}) {
  const rows = props.filter((p) => (findTrack(edits, target, p)?.points.length ?? 0) > 0)
  const [drag, setDrag] = useState<{ prop: KeyProp; from: number; to: number } | null>(null)
  const pct = (localEditMs: number) => `${keyframeLaneFraction(edits, originMs, span.fromMs, span.toMs, localEditMs) * 100}%`

  if (!rows.length) {
    return (
      <p className="w-full text-[11px] text-muted-foreground" data-testid="kf-lanes-empty">
        No keyframes yet
      </p>
    )
  }

  return (
    <div className="w-full space-y-0.5" data-testid="kf-lanes">
      {rows.map((prop) => {
        const track = findTrack(edits, target, prop)!
        const keys = track.points.filter((p) => p.tMs >= span.fromMs && p.tMs <= span.toMs)
        return (
          <div key={prop} className="flex w-full items-center gap-1">
            <span className="w-[62px] truncate text-[11px] text-muted-foreground">{PROP_SPECS[prop].label}</span>
            <div
              className="relative h-3.5 flex-1 rounded bg-muted/40"
              data-testid={`kf-lane-${prop}`}
              onPointerDown={(e) => {
                if (e.button !== 0) return
                const el = e.currentTarget
                const tEl = (e.target as HTMLElement).closest('[data-testid="kf-lane-key"]') as HTMLElement | null
                if (!tEl) return
                const from = Number(tEl.getAttribute('data-t-ms'))
                onSeekLocal(from)
                if (readOnly) return
                e.preventDefault()
                const r = el.getBoundingClientRect()
                let moved = false
                const snap = (clientX: number) => {
                  const frac = Math.min(1, Math.max(0, (clientX - r.left) / Math.max(1, r.width)))
                  let t = keyframeLocalEditFromLaneFraction(edits, originMs, span.fromMs, span.toMs, frac)
                  t = Math.round(t / FRAME_MS) * FRAME_MS
                  return Math.min(span.toMs, Math.max(span.fromMs, Math.round(t)))
                }
                const onMove = (ev: PointerEvent) => {
                  if (Math.abs(ev.clientX - e.clientX) >= DRAG_SLOP) moved = true
                  setDrag({ prop, from, to: snap(ev.clientX) })
                }
                const onUp = (ev: PointerEvent) => {
                  window.removeEventListener('pointermove', onMove)
                  window.removeEventListener('pointerup', onUp)
                  const to = snap(ev.clientX)
                  setDrag(null)
                  if (moved && Math.abs(to - from) >= 1) {
                    onCommit(moveTrackPoint(edits, target, prop, from, to))
                    onSeekLocal(to)
                  }
                }
                window.addEventListener('pointermove', onMove)
                window.addEventListener('pointerup', onUp)
              }}
            >
              <span
                className="pointer-events-none absolute top-0 bottom-0 z-[1] w-px bg-primary/70"
                style={{ left: pct(localMs) }}
              />
              {keys.map((p) => {
                const t = drag?.prop === prop && drag.from === p.tMs ? drag.to : p.tMs
                return (
                  <span
                    key={`${prop}-${p.tMs}`}
                    className="absolute top-1/2 z-[2] size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 cursor-ew-resize border border-black/60 bg-amber-400"
                    style={{ left: pct(t) }}
                    data-testid="kf-lane-key"
                    data-prop={prop}
                    data-t-ms={Math.round(p.tMs)}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
