'use client'

import { useCallback, useRef, useState, type PointerEvent as RPointerEvent, type WheelEvent as RWheelEvent } from 'react'
import type { ClipEditsV2, FacecamBox } from '@/lib/clips/edits'
import { findTrack, setPropertyAt, trackValueAt } from '@/lib/clips/editor/keyframes'
import { stackPanelStyles } from '@/lib/clips/facecam-geometry'

type Props = {
  baseEdits: ClipEditsV2
  box: HTMLElement | null
  getOutMs: () => number
  onCommit: (next: ClipEditsV2, pushHistory: boolean) => void
  readOnly?: boolean
  /** facecam_stack preview is showing (same condition preview-stage uses to draw the two panels) */
  stack: boolean
  /** top offset of the stack body (headline band), 0..1 */
  stackTopFrac: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const FULL: FacecamBox = { x: 0, y: 0, w: 1, h: 1 }

function fitBox(b: FacecamBox): FacecamBox {
  const w = clamp(b.w, 0.1, 1)
  const h = clamp(b.h, 0.1, 1)
  return { x: clamp(b.x, 0, 1 - w), y: clamp(b.y, 0, 1 - h), w, h }
}

function withFacecam(edits: ClipEditsV2, patch: Partial<NonNullable<ClipEditsV2['layout']['facecam']>>): ClipEditsV2 {
  const layout = { ...edits.layout } as Record<string, unknown>
  delete layout.template
  return {
    ...edits,
    layout: { ...layout, mode: 'facecam_stack', facecam: { ...(edits.layout.facecam ?? {}), ...patch } },
  } as ClipEditsV2
}

/** FIX1 (E.4): caption drag/resize, stack divider drag, per-panel pan (drag) + zoom (wheel). */
export function CanvasDirectHandles({ baseEdits, box, getOutMs, onCommit, readOnly, stack, stackTopFrac }: Props) {
  const drag = useRef<null | { kind: string; x0: number; y0: number; start: ClipEditsV2; w: number; h: number }>(null)
  const [capRect, setCapRect] = useState<DOMRect | null>(null)

  const refreshCaption = useCallback(() => {
    if (!box) return setCapRect(null)
    const el = box.querySelector('[data-testid="caption-line"]') as HTMLElement | null
    setCapRect(el ? el.getBoundingClientRect() : null)
  }, [box])

  const begin = (kind: string) => (e: RPointerEvent) => {
    if (readOnly || !box) return
    e.stopPropagation()
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const r = box.getBoundingClientRect()
    drag.current = { kind, x0: e.clientX, y0: e.clientY, start: baseEdits, w: r.width, h: r.height }
  }

  const apply = (e: RPointerEvent, push: boolean) => {
    const d = drag.current
    if (!d || !box) return
    const dx = e.clientX - d.x0
    const dy = e.clientY - d.y0
    const t = getOutMs()
    const val = (p: 'capX' | 'capY' | 'capScale') => trackValueAt(findTrack(d.start, 'captions', p), p, t)
    let next = d.start
    if (d.kind === 'cap-move') {
      next = setPropertyAt(next, 'captions', 'capX', t, val('capX') + (dx / d.w) * 100)
      next = setPropertyAt(next, 'captions', 'capY', t, val('capY') + (dy / d.h) * 100)
    } else if (d.kind === 'cap-scale') {
      next = setPropertyAt(next, 'captions', 'capScale', t, val('capScale') * (1 + dx / Math.max(40, d.w / 3)))
    } else if (d.kind === 'divider') {
      const r = box.getBoundingClientRect()
      const bodyTop = r.top + r.height * stackTopFrac
      const y = clamp((e.clientY - bodyTop) / (r.height * (1 - stackTopFrac)), 0, 1)
      const faceFirst = (d.start.layout.facecam?.position ?? 'top') !== 'bottom'
      next = withFacecam(d.start, { split: clamp(faceFirst ? y : 1 - y, 0.2, 0.7) })
    } else if (d.kind === 'pan-face' || d.kind === 'pan-game') {
      const fc = d.start.layout.facecam
      const key = d.kind === 'pan-face' ? 'box' : 'gameplay'
      const b0 = (key === 'box' ? fc?.box : fc?.gameplay) ?? FULL
      const { faceFrac, gameFrac } = stackPanelStyles(fc?.split ?? 0.4, fc?.position ?? 'top')
      const panelH = d.h * (1 - stackTopFrac) * (key === 'box' ? faceFrac : gameFrac)
      const nb = fitBox({ ...b0, x: b0.x - (dx / d.w) * b0.w, y: b0.y - (dy / Math.max(1, panelH)) * b0.h })
      next = withFacecam(d.start, key === 'box' ? { box: nb } : { gameplay: nb })
    }
    onCommit(next, push)
  }

  const end = (e: RPointerEvent) => {
    if (!drag.current) return
    apply(e, true)
    drag.current = null
    refreshCaption()
  }

  const zoomPanel = (key: 'box' | 'gameplay') => (e: RWheelEvent) => {
    if (readOnly) return
    e.stopPropagation()
    const fc = baseEdits.layout.facecam
    const b0 = (key === 'box' ? fc?.box : fc?.gameplay) ?? FULL
    const k = e.deltaY > 0 ? 1.06 : 1 / 1.06
    const w = clamp(b0.w * k, 0.1, 1)
    const h = clamp(b0.h * k, 0.1, 1)
    const nb = fitBox({ x: b0.x + (b0.w - w) / 2, y: b0.y + (b0.h - h) / 2, w, h })
    onCommit(withFacecam(baseEdits, key === 'box' ? { box: nb } : { gameplay: nb }), true)
  }

  if (!box || readOnly) return null
  const r = box.getBoundingClientRect()
  const fc = baseEdits.layout.facecam
  const { faceFrac, faceFirst } = stackPanelStyles(fc?.split ?? 0.4, fc?.position ?? 'top')
  const firstFrac = faceFirst ? faceFrac : 1 - faceFrac
  const bodyH = 1 - stackTopFrac
  const handlers = { onPointerMove: (e: RPointerEvent) => apply(e, false), onPointerUp: end, onPointerCancel: end }

  return (
    <div className="pointer-events-none absolute inset-0 z-20" data-testid="canvas-direct-handles" onPointerEnter={refreshCaption}>
      {stack ? (
        <>
          {(['first', 'second'] as const).map((slot) => {
            const isFace = (slot === 'first') === faceFirst
            const top = stackTopFrac + (slot === 'first' ? 0 : firstFrac * bodyH)
            const h = (slot === 'first' ? firstFrac : 1 - firstFrac) * bodyH
            return (
              <div
                key={slot}
                data-testid={isFace ? 'stack-pan-face' : 'stack-pan-game'}
                className="pointer-events-auto absolute inset-x-0 cursor-grab active:cursor-grabbing"
                style={{ top: `${top * 100}%`, height: `${h * 100}%` }}
                title="Drag to reframe · scroll to zoom"
                onPointerDown={begin(isFace ? 'pan-face' : 'pan-game')}
                onWheel={zoomPanel(isFace ? 'box' : 'gameplay')}
                {...handlers}
              />
            )
          })}
          <div
            data-testid="stack-divider"
            className="pointer-events-auto absolute inset-x-0 h-3 -translate-y-1/2 cursor-row-resize bg-white/0 hover:bg-white/40"
            style={{ top: `${(stackTopFrac + firstFrac * bodyH) * 100}%` }}
            onPointerDown={begin('divider')}
            {...handlers}
          />
        </>
      ) : null}
      {capRect ? (
        <div
          data-testid="caption-drag-box"
          className="pointer-events-auto absolute cursor-move rounded border border-dashed border-white/70"
          style={{
            left: capRect.left - r.left - 4,
            top: capRect.top - r.top - 4,
            width: capRect.width + 8,
            height: capRect.height + 8,
          }}
          onPointerDown={begin('cap-move')}
          {...handlers}
        >
          <div
            data-testid="caption-scale-handle"
            className="absolute -bottom-1.5 -right-1.5 size-3 cursor-nwse-resize rounded-sm bg-white"
            onPointerDown={begin('cap-scale')}
            {...handlers}
          />
        </div>
      ) : null}
    </div>
  )
}
