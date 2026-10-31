/**
 * G1a on-canvas editing math (pure; the DOM side is components/clips/editor/canvas-selection-overlay.tsx).
 *
 * A layer is an element of size (ew, eh) at (ex, ey) in preview-box px, transformed like
 * transformCss(): p' = O + T + R(rotation) · S(scale) · (p − O), T = (x % · ew, y % · eh).
 * Its visible content is `content` (a rect inside the element, already reduced by the crop).
 * Every drag maps back to the same keyframe props the inspector / timeline edit (x, y, scale,
 * rotation, cropL/T/R/B) — so a canvas edit is an ordinary manual edit (auto-keys when keyed).
 */
import type { LayerTransform } from '@/lib/clips/editor/keyframes'
import type { LayerCrop } from '@/lib/clips/editor/layer-props'

export type Pt = { x: number; y: number }
export type Rect = { x: number; y: number; w: number; h: number }
export type LayerGeom = {
  /** untransformed element rect (box px) — translate % is relative to its size */
  el: Rect
  /** transform origin (box px) */
  origin: Pt
  /** untransformed visible content rect (box px) */
  content: Rect
  t: LayerTransform
}

const rad = (d: number) => (d * Math.PI) / 180

export function applyTransform(g: Pick<LayerGeom, 'el' | 'origin' | 't'>, p: Pt): Pt {
  const s = g.t.scale / 100
  const a = rad(g.t.rotation)
  const dx = (p.x - g.origin.x) * s
  const dy = (p.y - g.origin.y) * s
  return {
    x: g.origin.x + (g.t.x / 100) * g.el.w + dx * Math.cos(a) - dy * Math.sin(a),
    y: g.origin.y + (g.t.y / 100) * g.el.h + dx * Math.sin(a) + dy * Math.cos(a),
  }
}

export function invertTransform(g: Pick<LayerGeom, 'el' | 'origin' | 't'>, p: Pt): Pt {
  const s = Math.max(1e-6, g.t.scale / 100)
  const a = -rad(g.t.rotation)
  const qx = p.x - g.origin.x - (g.t.x / 100) * g.el.w
  const qy = p.y - g.origin.y - (g.t.y / 100) * g.el.h
  return {
    x: g.origin.x + (qx * Math.cos(a) - qy * Math.sin(a)) / s,
    y: g.origin.y + (qx * Math.sin(a) + qy * Math.cos(a)) / s,
  }
}

/** Corners TL, TR, BR, BL of the transformed content (screen px). */
export function contentQuad(g: LayerGeom): [Pt, Pt, Pt, Pt] {
  const { x, y, w, h } = g.content
  return [
    applyTransform(g, { x, y }),
    applyTransform(g, { x: x + w, y }),
    applyTransform(g, { x: x + w, y: y + h }),
    applyTransform(g, { x, y: y + h }),
  ]
}

export function quadBounds(q: readonly Pt[]): Rect {
  const xs = q.map((p) => p.x)
  const ys = q.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

export function pointInLayer(g: LayerGeom, p: Pt, slopPx = 0): boolean {
  const l = invertTransform(g, p)
  const s = Math.max(1e-6, g.t.scale / 100)
  const pad = slopPx / s
  const c = g.content
  return l.x >= c.x - pad && l.x <= c.x + c.w + pad && l.y >= c.y - pad && l.y <= c.y + c.h + pad
}

/** Screen centre of the content (what the move / scale / rotate gestures pivot around). */
export function contentCentre(g: LayerGeom): Pt {
  return applyTransform(g, { x: g.content.x + g.content.w / 2, y: g.content.y + g.content.h / 2 })
}

/** Screen pivot (origin + translation) — scale / rotation are about this point. */
export function pivot(g: LayerGeom): Pt {
  return applyTransform(g, g.origin)
}

// ---------------------------------------------------------------------------
// Snapping (CapCut-style guides at the frame edges + centre, and the other layers' edges / centres)
// ---------------------------------------------------------------------------

export type Guide = { axis: 'x' | 'y'; at: number }
export const SNAP_PX = 6

function snap1(features: number[], targets: number[], th: number): { d: number; at: number } | null {
  let best: { d: number; at: number } | null = null
  for (const f of features) {
    for (const t of targets) {
      const d = t - f
      if (Math.abs(d) <= th && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: t }
    }
  }
  return best
}

/**
 * Snap a moved bounding box. Returns the px correction to add to the move and the guides to draw.
 * `others` = bounding boxes of other visible layers (their edges + centres are targets too).
 */
export function snapMove(b: Rect, frame: { w: number; h: number }, others: Rect[] = [], th = SNAP_PX): { dx: number; dy: number; guides: Guide[] } {
  const tx = [0, frame.w / 2, frame.w, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])]
  const ty = [0, frame.h / 2, frame.h, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])]
  const sx = snap1([b.x, b.x + b.w / 2, b.x + b.w], tx, th)
  const sy = snap1([b.y, b.y + b.h / 2, b.y + b.h], ty, th)
  const guides: Guide[] = []
  if (sx) guides.push({ axis: 'x', at: sx.at })
  if (sy) guides.push({ axis: 'y', at: sy.at })
  return { dx: sx?.d ?? 0, dy: sy?.d ?? 0, guides }
}

/** Rotation snap: multiples of 15° with Shift, else 0 / ±90 / ±180 within 3°. */
export function snapRotation(deg: number, coarse: boolean): number {
  if (coarse) return Math.round(deg / 15) * 15
  for (const t of [-360, -270, -180, -90, 0, 90, 180, 270, 360]) if (Math.abs(deg - t) <= 3) return t
  return Math.round(deg * 10) / 10
}

// ---------------------------------------------------------------------------
// Gestures → prop values
// ---------------------------------------------------------------------------

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const r2 = (v: number) => Math.round(v * 100) / 100

/** Body drag: px delta → x / y (% of the element). */
export function moveTo(g: LayerGeom, dxPx: number, dyPx: number): { x: number; y: number } {
  return {
    x: r2(clamp(g.t.x + (dxPx / Math.max(1, g.el.w)) * 100, -100, 100)),
    y: r2(clamp(g.t.y + (dyPx / Math.max(1, g.el.h)) * 100, -100, 100)),
  }
}

/** Corner drag: uniform scale from the distance to the pivot. */
export function scaleTo(g: LayerGeom, start: Pt, now: Pt): number {
  const c = pivot(g)
  const d0 = Math.hypot(start.x - c.x, start.y - c.y)
  const d1 = Math.hypot(now.x - c.x, now.y - c.y)
  if (d0 < 2) return g.t.scale
  return r2(clamp((g.t.scale * d1) / d0, 10, 400))
}

/** Rotate handle: angle swept around the pivot. */
export function rotateTo(g: LayerGeom, start: Pt, now: Pt, coarse = false): number {
  const c = pivot(g)
  const a0 = Math.atan2(start.y - c.y, start.x - c.x)
  const a1 = Math.atan2(now.y - c.y, now.x - c.x)
  let d = ((a1 - a0) * 180) / Math.PI
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return clamp(snapRotation(g.t.rotation + d, coarse), -360, 360)
}

export type CropEdge = 'l' | 't' | 'r' | 'b'

/**
 * Crop edge drag (screen-oriented crop, i.e. what the user sees; convert with screenToMediaCrop).
 * The pointer is mapped back into the element (inverse transform), so rotated / scaled layers
 * crop along their own edges.
 */
export function cropTo(g: LayerGeom, screenCrop: LayerCrop, edge: CropEdge, now: Pt): LayerCrop {
  const l = invertTransform(g, now)
  const u = ((l.x - g.el.x) / Math.max(1, g.el.w)) * 100
  const v = ((l.y - g.el.y) / Math.max(1, g.el.h)) * 100
  const c = { ...screenCrop }
  const MAXV = 95
  if (edge === 'l') c.l = r2(clamp(u, 0, MAXV - c.r))
  if (edge === 'r') c.r = r2(clamp(100 - u, 0, MAXV - c.l))
  if (edge === 't') c.t = r2(clamp(v, 0, MAXV - c.b))
  if (edge === 'b') c.b = r2(clamp(100 - v, 0, MAXV - c.t))
  return c
}

/** Element rect reduced by a screen-oriented crop. */
export function croppedRect(el: Rect, c: LayerCrop): Rect {
  return {
    x: el.x + (el.w * c.l) / 100,
    y: el.y + (el.h * c.t) / 100,
    w: (el.w * (100 - c.l - c.r)) / 100,
    h: (el.h * (100 - c.t - c.b)) / 100,
  }
}

/** Parse a CSS transform-origin made of % / px values against a rect. */
export function parseOrigin(origin: string, el: Rect): Pt {
  const parts = origin.trim().split(/\s+/)
  const one = (s: string | undefined, size: number, off: number) => {
    if (!s) return off + size / 2
    if (s.endsWith('%')) return off + (parseFloat(s) / 100) * size
    if (s.endsWith('px')) return off + parseFloat(s)
    if (s === 'left' || s === 'top') return off
    if (s === 'right' || s === 'bottom') return off + size
    return off + size / 2
  }
  return { x: one(parts[0], el.w, el.x), y: one(parts[1], el.h, el.y) }
}
