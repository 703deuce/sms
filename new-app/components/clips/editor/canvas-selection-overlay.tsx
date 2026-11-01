'use client'

/**
 * G1a on-canvas editing (CapCut / Descript style), fully manual — no AI, no credits:
 *  - click a layer in the preview to select it (top-most first: text items, hook, B-roll, video)
 *  - drag the body to move (snaps to the frame edges / centre and other layers, guides shown;
 *    hold Alt to move freely), drag a corner to scale, drag the round handle to rotate (Shift = 15°)
 *  - crop mode (picture layers): drag the edge bars; flips are respected
 *  - double-click a text item (or the hook) to edit its words in place
 * Every gesture writes the ordinary keyframe props at the playhead (setPropertyAt → auto-keys once
 * a prop has keyframes), so the export renders exactly what the preview shows.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import {
  isMediaLayerTarget,
  layerTransformAt,
  setPropertyAt,
  targetOriginMs,
  type KeyframeTarget,
} from '@/lib/clips/editor/keyframes'
import {
  contentQuad,
  croppedRect,
  cropTo,
  moveTo,
  parseOrigin,
  pointInLayer,
  quadBounds,
  rotateTo,
  scaleTo,
  snapMove,
  type CropEdge,
  type Guide,
  type LayerGeom,
  type Pt,
  type Rect,
} from '@/lib/clips/editor/canvas-geometry'
import { layerCropAt, layerFlip, mediaToScreenCrop, screenToMediaCrop, setCropAt, setLayerFlip } from '@/lib/clips/editor/layer-props'
import { rotateBy90 } from '@/lib/clips/editor/canvas-ops'

export type CanvasLayerDom = {
  target: KeyframeTarget
  /** the transformed layer element */
  el: HTMLElement | null
  /** untransformed element whose rect equals the layer's (defaults to el.parentElement) */
  frame?: HTMLElement | null
  /** visible content inside a text layer (block / hook text) */
  content?: HTMLElement | null
}

type Props = {
  /** what the preview shows (lane state applied) — geometry / hit-testing */
  edits: ClipEditsV2
  /** the saved edits — every commit is computed from these (never persist lane-state edits) */
  baseEdits: ClipEditsV2
  box: HTMLElement | null
  getOutMs: () => number
  /** bottom → top */
  getLayers: () => CanvasLayerDom[]
  selected: KeyframeTarget | null
  onSelect: (target: KeyframeTarget | null) => void
  onCommit: (next: ClipEditsV2, pushHistory: boolean) => void
  cropMode: boolean
  onCropModeChange: (on: boolean) => void
  readOnly?: boolean
}

const laneOf = (t: KeyframeTarget) => (t === 'video' ? 'video' : t.startsWith('broll:') ? 'broll' : 'text')

function relRect(el: Element, box: DOMRect): Rect {
  const r = el.getBoundingClientRect()
  return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height }
}

/** Geometry of one layer right now (pure math on untransformed DOM rects). */
export function layerGeom(edits: ClipEditsV2, l: CanvasLayerDom, boxRect: DOMRect, outMs: number): LayerGeom | null {
  if (!l.el) return null
  const frameEl = l.frame ?? l.el.parentElement
  if (!frameEl) return null
  const el = relRect(frameEl, boxRect)
  if (el.w <= 0 || el.h <= 0) return null
  const local = outMs - targetOriginMs(edits, l.target)
  const t = layerTransformAt(edits, l.target, local)
  const origin = parseOrigin(l.el.style.transformOrigin || '50% 50%', el)
  let content: Rect = el
  if (isMediaLayerTarget(l.target)) {
    content = croppedRect(el, mediaToScreenCrop(layerCropAt(edits, l.target, local), layerFlip(edits, l.target)))
  } else if (l.content) {
    const c = l.content
    const centred = (c.style.transform || '').includes('-50%')
    const w = c.offsetWidth
    const h = c.offsetHeight
    content = { x: el.x + c.offsetLeft - (centred ? w / 2 : 0), y: el.y + c.offsetTop - (centred ? h / 2 : 0), w, h }
    if (w <= 0 || h <= 0) return null
  }
  return { el, origin, content, t }
}

function visible(l: CanvasLayerDom): boolean {
  return Boolean(l.el && l.el.style.visibility !== 'hidden' && l.el.style.opacity !== '0')
}

type Drag =
  | { kind: 'move'; start: Pt; g: LayerGeom; base: ClipEditsV2; local: number; others: Rect[]; pushed: boolean }
  | { kind: 'scale'; start: Pt; g: LayerGeom; base: ClipEditsV2; local: number; pushed: boolean }
  | { kind: 'rotate'; start: Pt; g: LayerGeom; base: ClipEditsV2; local: number; pushed: boolean }
  | { kind: 'crop'; edge: CropEdge; g: LayerGeom; base: ClipEditsV2; local: number; pushed: boolean }

const SKIP = 'button, a, input, textarea, select, [role="button"], [role="slider"], [data-canvas-skip]'

const CHIP_BAND = 32

/** Keep corner handles inside the stage (main video fills the frame; handles were clipped). */
export function insetCanvasHandle(
  p: Pt,
  boxW: number,
  boxH: number,
  inset = 10,
  bottomBand = 0,
): Pt {
  if (boxW <= inset * 2 || boxH <= inset * 2) return p
  const maxY = bottomBand > 0 ? boxH - bottomBand / 2 - inset : boxH - inset
  return {
    x: Math.min(boxW - inset, Math.max(inset, p.x)),
    y: Math.min(maxY, Math.max(inset, p.y)),
  }
}

/** TC4a + CV09fix: floating toolbar placement (pure for tests). */
export function floatToolbarTop(b: { x: number; y: number; w: number; h: number }, H: number, band = CHIP_BAND): number {
  const below = b.y + b.h + 6
  if (b.y > 34) return b.y - 30
  if (below <= H - band - 26) return below
  return 4
}

export function CanvasSelectionOverlay({
  edits,
  baseEdits,
  box,
  getOutMs,
  getLayers,
  selected,
  onSelect,
  onCommit,
  cropMode,
  onCropModeChange,
  readOnly = false,
}: Props) {
  const [quad, setQuad] = useState<Pt[] | null>(null)
  const [guides, setGuides] = useState<Guide[]>([])
  const [editing, setEditing] = useState<{ target: KeyframeTarget; rect: Rect; text: string } | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const editDoneRef = useRef(false)
  const editsRef = useRef(edits)
  editsRef.current = edits
  const baseRef = useRef(baseEdits)
  baseRef.current = baseEdits
  const selRef = useRef(selected)
  selRef.current = selected

  const geomOf = useCallback(
    (target: KeyframeTarget, e = editsRef.current) => {
      if (!box) return null
      const l = getLayers().find((x) => x.target === target)
      return l ? layerGeom(e, l, box.getBoundingClientRect(), getOutMs()) : null
    },
    [box, getLayers, getOutMs],
  )

  // Selection outline follows the playhead / keyframes (cheap: one rect read per frame).
  useLayoutEffect(() => {
    if (!selected || !box) {
      setQuad(null)
      return
    }
    let raf = 0
    let last = ''
    const tick = () => {
      const l = getLayers().find((x) => x.target === selected)
      const g = l && visible(l) ? layerGeom(editsRef.current, l, box.getBoundingClientRect(), getOutMs()) : null
      const q = g ? contentQuad(g) : null
      const key = q ? q.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') : ''
      if (key !== last) {
        last = key
        setQuad(q)
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [selected, box, getLayers, getOutMs])

  const commit = useCallback(
    (d: Drag, next: ClipEditsV2) => {
      onCommit(next, !d.pushed)
      d.pushed = true
    },
    [onCommit],
  )

  const pointIn = useCallback(
    (ev: PointerEvent | MouseEvent): Pt | null => {
      if (!box) return null
      const b = box.getBoundingClientRect()
      return { x: ev.clientX - b.left, y: ev.clientY - b.top }
    },
    [box],
  )

  const hitTest = useCallback(
    (p: Pt): KeyframeTarget | null => {
      if (!box) return null
      const b = box.getBoundingClientRect()
      const layers = getLayers()
      for (let i = layers.length - 1; i >= 0; i--) {
        const l = layers[i]!
        if (!visible(l)) continue
        const g = layerGeom(editsRef.current, l, b, getOutMs())
        if (g && pointInLayer(g, p, l.target === 'video' ? 0 : 4)) return l.target
      }
      return null
    },
    [box, getLayers, getOutMs],
  )

  const locked = (t: KeyframeTarget) => Boolean(editsRef.current.timelineLanes?.[laneOf(t)]?.locked)

  // Body press on the preview: select (+ start a move).
  useEffect(() => {
    if (!box) return
    const down = (ev: PointerEvent) => {
      if (ev.button !== 0 || editing) return
      const target = ev.target as Element | null
      if (target?.closest(SKIP)) return
      const p = pointIn(ev)
      if (!p) return
      const hit = hitTest(p)
      onSelect(hit)
      if (!hit || readOnly || locked(hit)) return
      const g = geomOf(hit)
      if (!g) return
      const e = editsRef.current
      const others = getLayers()
        .filter((l) => l.target !== hit && l.target !== 'video' && visible(l))
        .map((l) => layerGeom(e, l, box.getBoundingClientRect(), getOutMs()))
        .filter((x): x is LayerGeom => Boolean(x))
        .map((x) => quadBounds(contentQuad(x)))
      dragRef.current = { kind: 'move', start: p, g, base: baseRef.current, local: getOutMs() - targetOriginMs(e, hit), others, pushed: false }
      ev.preventDefault()
    }
    box.addEventListener('pointerdown', down)
    return () => box.removeEventListener('pointerdown', down)
  }, [box, editing, geomOf, getLayers, getOutMs, hitTest, onSelect, pointIn, readOnly])

  // Drag updates (window-level so leaving the preview keeps the gesture).
  useEffect(() => {
    const move = (ev: PointerEvent) => {
      const d = dragRef.current
      const target = selRef.current
      if (!d || !target) return
      const p = pointIn(ev)
      if (!p) return
      if (d.kind === 'move') {
        let dx = p.x - d.start.x
        let dy = p.y - d.start.y
        if (!ev.altKey && box) {
          const b0 = quadBounds(contentQuad(d.g))
          const moved = { ...b0, x: b0.x + dx, y: b0.y + dy }
          const s = snapMove(moved, { w: box.clientWidth, h: box.clientHeight }, d.others)
          dx += s.dx
          dy += s.dy
          setGuides(s.guides)
        } else setGuides([])
        const v = moveTo(d.g, dx, dy)
        commit(d, setPropertyAt(setPropertyAt(d.base, target, 'x', d.local, v.x), target, 'y', d.local, v.y))
      } else if (d.kind === 'scale') {
        commit(d, setPropertyAt(d.base, target, 'scale', d.local, scaleTo(d.g, d.start, p)))
      } else if (d.kind === 'rotate') {
        commit(d, setPropertyAt(d.base, target, 'rotation', d.local, rotateTo(d.g, d.start, p, ev.shiftKey)))
      } else if (d.kind === 'crop') {
        const flip = layerFlip(d.base, target)
        const scr = mediaToScreenCrop(layerCropAt(d.base, target, d.local), flip)
        const next = cropTo(d.g, scr, d.edge, p)
        commit(d, setCropAt(d.base, target, d.local, screenToMediaCrop(next, flip)))
      }
    }
    const up = () => {
      dragRef.current = null
      setGuides([])
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [box, commit, pointIn])

  // Double-click: edit a text item / the hook in place.
  useEffect(() => {
    if (!box) return
    const dbl = (ev: MouseEvent) => {
      if (readOnly) return
      const p = pointIn(ev)
      if (!p) return
      const hit = hitTest(p)
      if (!hit || isMediaLayerTarget(hit) || locked(hit)) {
        if (hit && isMediaLayerTarget(hit) && !locked(hit)) onCropModeChange(true)
        return
      }
      const g = geomOf(hit)
      if (!g) return
      const e = baseRef.current
      const text =
        hit === 'text' ? e.hookOverlay?.text ?? '' : e.textItems?.find((t) => `text:${t.id}` === hit)?.text ?? ''
      onSelect(hit)
      editDoneRef.current = false
      setEditing({ target: hit, rect: quadBounds(contentQuad(g)), text })
      ev.preventDefault()
    }
    box.addEventListener('dblclick', dbl)
    return () => box.removeEventListener('dblclick', dbl)
  }, [box, geomOf, hitTest, onCropModeChange, onSelect, pointIn, readOnly])

  const startHandle = (kind: 'scale' | 'rotate' | 'crop', edge?: CropEdge) => (ev: React.PointerEvent) => {
    const target = selected
    if (!target || readOnly || locked(target)) return
    ev.stopPropagation()
    ev.preventDefault()
    const p = pointIn(ev.nativeEvent)
    const g = geomOf(target)
    if (!p || !g) return
    const e = baseRef.current
    const local = getOutMs() - targetOriginMs(editsRef.current, target)
    dragRef.current =
      kind === 'crop'
        ? { kind, edge: edge!, g: { ...g, content: g.el }, base: e, local, pushed: false }
        : { kind, start: p, g, base: e, local, pushed: false }
  }

  const finishEdit = (save: boolean) => {
    const ed = editing
    if (editDoneRef.current) return
    editDoneRef.current = true
    setEditing(null)
    if (!ed || !save) return
    const e = baseRef.current
    const text = ed.text.replace(/\r/g, '')
    if (!text.trim()) return
    if (ed.target === 'text') {
      if (!e.hookOverlay || e.hookOverlay.text === text) return
      onCommit({ ...e, hookOverlay: { ...e.hookOverlay, text } }, true)
      return
    }
    const id = ed.target.slice(5)
    const items = e.textItems ?? []
    if (!items.some((t) => t.id === id && t.text !== text)) return
    onCommit({ ...e, textItems: items.map((t) => (t.id === id ? { ...t, text } : t)) }, true)
  }

  const media = selected ? isMediaLayerTarget(selected) : false
  const showCrop = cropMode && media
  const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  let rot: { at: Pt; stem: Pt } | null = null
  if (quad) {
    const top = mid(quad[0]!, quad[1]!)
    const bottom = mid(quad[3]!, quad[2]!)
    const len = Math.hypot(top.x - bottom.x, top.y - bottom.y) || 1
    const ux = (top.x - bottom.x) / len
    const uy = (top.y - bottom.y) / len
    rot = { at: { x: top.x + ux * 22, y: top.y + uy * 22 }, stem: top }
  }
  const canEdit = !readOnly && selected != null && !locked(selected)
  const W = box?.clientWidth ?? 0
  const H = box?.clientHeight ?? 0

  return (
    <div className="pointer-events-none absolute inset-0 z-[40]" data-testid="canvas-selection-overlay" data-canvas-skip>
      <svg className="absolute inset-0 size-full overflow-visible" aria-hidden>
        {guides.map((g, i) =>
          g.axis === 'x' ? (
            <line key={i} x1={g.at} x2={g.at} y1={0} y2={H} stroke="#f0f" strokeWidth={1} strokeDasharray="4 3" data-testid="canvas-guide-x" />
          ) : (
            <line key={i} x1={0} x2={W} y1={g.at} y2={g.at} stroke="#f0f" strokeWidth={1} strokeDasharray="4 3" data-testid="canvas-guide-y" />
          ),
        )}
        {quad ? (
          <polygon
            points={quad.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={showCrop ? '#facc15' : '#fff'}
            strokeWidth={1.5}
            style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,.9))' }}
            data-testid="canvas-selection-box"
            data-target={selected ?? ''}
          />
        ) : null}
        {quad && rot && canEdit && !showCrop ? <line x1={rot.stem.x} y1={rot.stem.y} x2={rot.at.x} y2={rot.at.y} stroke="#fff" strokeWidth={1} /> : null}
      </svg>
      {quad && canEdit && !showCrop
        ? quad.map((p, i) => {
            const at =
              selected === 'video' && box
                ? insetCanvasHandle(p, box.clientWidth, box.clientHeight, 10, CHIP_BAND)
                : p
            return (
            <div
              key={i}
              role="presentation"
              className="pointer-events-auto absolute size-3 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize rounded-sm border border-black/60 bg-white"
              style={{ left: at.x, top: at.y }}
              onPointerDown={startHandle('scale')}
              data-testid="canvas-handle-scale"
            />
            )
          })
        : null}
      {quad && rot && canEdit && !showCrop ? (
        <div
          role="presentation"
          className="pointer-events-auto absolute size-3.5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border border-black/60 bg-white"
          style={{ left: rot.at.x, top: rot.at.y }}
          onPointerDown={startHandle('rotate')}
          data-testid="canvas-handle-rotate"
          title="Rotate (Shift: 15° steps)"
        />
      ) : null}
      {quad && canEdit && showCrop
        ? (['t', 'r', 'b', 'l'] as CropEdge[]).map((edge, i) => {
            const a = quad[i]!
            const b = quad[(i + 1) % 4]!
            const m = mid(a, b)
            const horiz = edge === 't' || edge === 'b'
            return (
              <div
                key={edge}
                role="presentation"
                className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded bg-yellow-300 ${horiz ? 'h-1.5 w-6 cursor-ns-resize' : 'h-6 w-1.5 cursor-ew-resize'}`}
                style={{ left: m.x, top: m.y }}
                onPointerDown={startHandle('crop', edge)}
                data-testid={`canvas-handle-crop-${edge}`}
              />
            )
          })
        : null}
      {quad && canEdit && selected ? (
        // TC4a (CV-15): floating selection toolbar above the selected layer (crop, rotate, flip, reset).
        <div
          className="pointer-events-auto absolute flex items-center gap-0.5 rounded-md bg-black/80 p-0.5 text-[11px] font-medium text-white shadow-lg ring-1 ring-white/15"
          style={{
            left: Math.max(4, Math.min(W - 230, quadBounds(quad).x)),
            top: floatToolbarTop(quadBounds(quad), H),
          }}
          onPointerDown={(e) => e.stopPropagation()}
          role="toolbar"
          aria-label="Selected layer"
          data-testid="canvas-float-toolbar"
        >
          {media ? (
            <button type="button" className="rounded px-1.5 py-0.5 hover:bg-white/15" onClick={() => onCropModeChange(!cropMode)} data-testid="canvas-crop-toggle">
              {showCrop ? 'Done' : 'Crop'}
            </button>
          ) : null}
          <button type="button" className="rounded px-1.5 py-0.5 hover:bg-white/15" title="Rotate 90° left" onClick={() => onCommit(rotateBy90(baseRef.current, selected, -1), true)} data-testid="canvas-tb-rotate-left">
            ↺
          </button>
          <button type="button" className="rounded px-1.5 py-0.5 hover:bg-white/15" title="Rotate 90° right" onClick={() => onCommit(rotateBy90(baseRef.current, selected, 1), true)} data-testid="canvas-tb-rotate-right">
            ↻
          </button>
          {media ? (
            <>
              <button type="button" className="rounded px-1.5 py-0.5 hover:bg-white/15" title="Flip horizontal" onClick={() => onCommit(setLayerFlip(baseRef.current, selected, 'h', !layerFlip(baseRef.current, selected).h), true)} data-testid="canvas-tb-flip-h">
                ⇋
              </button>
              <button type="button" className="rounded px-1.5 py-0.5 hover:bg-white/15" title="Flip vertical" onClick={() => onCommit(setLayerFlip(baseRef.current, selected, 'v', !layerFlip(baseRef.current, selected).v), true)} data-testid="canvas-tb-flip-v">
                ⇵
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="rounded px-1.5 py-0.5 hover:bg-white/15"
            title="Reset position, size, rotation and opacity"
            onClick={() => {
              const e = baseRef.current
              const keep = (e.keyframes ?? []).filter((k) => !(k.target === selected && ['x', 'y', 'scale', 'rotation', 'opacity'].includes(k.prop)))
              onCommit({ ...e, keyframes: keep.length ? keep : undefined }, true)
            }}
            data-testid="canvas-tb-reset"
          >
            Reset
          </button>
        </div>
      ) : null}
      {editing ? (
        <textarea
          autoFocus
          className="pointer-events-auto absolute resize-none rounded border border-white/80 bg-black/70 p-1 text-center text-sm text-white outline-none"
          style={{
            left: Math.max(0, editing.rect.x),
            top: Math.max(0, editing.rect.y),
            width: Math.max(120, editing.rect.w),
            height: Math.max(40, editing.rect.h),
          }}
          value={editing.text}
          onChange={(e) => setEditing({ ...editing, text: e.target.value })}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Escape') finishEdit(false)
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) finishEdit(true)
          }}
          onBlur={() => finishEdit(true)}
          data-testid="canvas-text-editor"
          aria-label="Edit text"
        />
      ) : null}
    </div>
  )
}
