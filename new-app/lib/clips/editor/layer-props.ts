/**
 * G1a: crop, flip and stacking order of preview / export layers (pure; no DOM).
 * Mirrored by worker/clips_worker/motion.py (layer_crop_at, layer_flip, stack_order); the shared
 * parity fixture is worker/tests/fixtures/g1a_layer_parity.json.
 *
 * Order of operations (preview CSS and the worker filter chain are the same affine map):
 *   crop (inset in the un-flipped media) → flip → scale / rotate about the centre → translate.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import {
  CROP_MIN_VISIBLE,
  CROP_PROPS,
  isMediaLayerTarget,
  normalizeLayerProps,
  stackOrder,
  STACK_OVERLAP_TOL_MS,
  type CropProp,
  type KeyframeTarget,
  type LayerProp,
} from '@/lib/clips/editor/motion-schema'
import { findTrack, setPropertyAt, trackValueAt } from '@/lib/clips/editor/keyframes'

export type LayerCrop = { l: number; t: number; r: number; b: number }
export const NO_CROP: LayerCrop = { l: 0, t: 0, r: 0, b: 0 }

/** Clamp one axis so at least CROP_MIN_VISIBLE % stays visible (the far edge gives way). */
export function clampCropAxis(a: number, b: number): [number, number] {
  const max = 100 - CROP_MIN_VISIBLE
  const aa = Math.min(max, Math.max(0, a))
  const bb = Math.min(max - aa, Math.max(0, b))
  return [aa, bb]
}

/** Effective crop of a target at local time (raw keyframed values, then the visibility clamp). */
export function layerCropAt(edits: ClipEditsV2, target: KeyframeTarget, localMs: number): LayerCrop {
  if (!isMediaLayerTarget(target)) return NO_CROP
  const v = (p: CropProp) => trackValueAt(findTrack(edits, target, p), p, localMs)
  const [l, r] = clampCropAxis(v('cropL'), v('cropR'))
  const [t, b] = clampCropAxis(v('cropT'), v('cropB'))
  return { l, t, r, b }
}

export function hasCrop(edits: ClipEditsV2, target: KeyframeTarget): boolean {
  return CROP_PROPS.some((p) => {
    const tr = findTrack(edits, target, p)
    return Boolean(tr && (tr.points.length || (tr.value ?? 0) !== 0))
  })
}

export function isNoCrop(c: LayerCrop): boolean {
  return c.l === 0 && c.t === 0 && c.r === 0 && c.b === 0
}

const pc = (n: number) => `${Math.round(n * 1000) / 1000}%`

/** CSS clip-path (element-local, i.e. applied before the element's own transform). */
export function cropClipPath(c: LayerCrop): string {
  return isNoCrop(c) ? '' : `inset(${pc(c.t)} ${pc(c.r)} ${pc(c.b)} ${pc(c.l)})`
}

function parseInset(s: string): [number, number, number, number] | null {
  const m = /^inset\(\s*([-\d.]+)%\s+([-\d.]+)%\s+([-\d.]+)%\s+([-\d.]+)%\s*\)$/.exec(s.trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])] : null
}

/** Intersection of two inset() clip paths on the same element ('' = no clip). */
export function intersectClipPaths(a: string, b: string): string {
  if (!a) return b
  if (!b) return a
  const pa = parseInset(a)
  const pb = parseInset(b)
  if (!pa || !pb) return a
  const m = pa.map((v, i) => Math.max(v, pb[i]!))
  return `inset(${pc(m[0]!)} ${pc(m[1]!)} ${pc(m[2]!)} ${pc(m[3]!)})`
}

/** Mirror an inset() clip for a flipped element (screen-space clips such as wipes stay put). */
export function mirrorClipPath(clip: string, f: { h: boolean; v: boolean }): string {
  if (!clip || (!f.h && !f.v)) return clip
  const p = parseInset(clip)
  if (!p) return clip
  const [t, r, b, l] = p
  const [tt, bb] = f.v ? [b, t] : [t, b]
  const [ll, rr] = f.h ? [r, l] : [l, r]
  return `inset(${pc(tt)} ${pc(rr)} ${pc(bb)} ${pc(ll)})`
}

export function layerPropOf(edits: ClipEditsV2, target: KeyframeTarget): LayerProp | undefined {
  return edits.layerProps?.find((p) => p.target === target)
}

export function layerFlip(edits: ClipEditsV2, target: KeyframeTarget): { h: boolean; v: boolean } {
  const p = isMediaLayerTarget(target) ? layerPropOf(edits, target) : undefined
  return { h: Boolean(p?.flipH), v: Boolean(p?.flipV) }
}

/** CSS appended at the END of the layer transform (so it applies first, right after the clip). */
export function flipCss(f: { h: boolean; v: boolean }): string {
  if (!f.h && !f.v) return ''
  return `scale(${f.h ? -1 : 1}, ${f.v ? -1 : 1})`
}

export function layerZ(edits: ClipEditsV2, target: KeyframeTarget): number {
  return layerPropOf(edits, target)?.z ?? 0
}

function withLayerProp(edits: ClipEditsV2, target: KeyframeTarget, patch: Partial<LayerProp>): ClipEditsV2 {
  const cur = layerPropOf(edits, target) ?? { target }
  const merged: Record<string, unknown> = { ...cur, ...patch, target }
  for (const k of Object.keys(merged)) if (merged[k] === undefined || merged[k] === false) delete merged[k]
  const rest = (edits.layerProps ?? []).filter((p) => p.target !== target)
  return { ...edits, layerProps: normalizeLayerProps([...rest, merged]) }
}

export function setLayerFlip(edits: ClipEditsV2, target: KeyframeTarget, axis: 'h' | 'v', on: boolean): ClipEditsV2 {
  if (!isMediaLayerTarget(target)) return edits
  return withLayerProp(edits, target, axis === 'h' ? { flipH: on ? true : undefined } : { flipV: on ? true : undefined })
}

/** Crop edit at the playhead (static, or an auto-key when the edge already has keyframes). */
export function setCropAt(edits: ClipEditsV2, target: KeyframeTarget, localMs: number, crop: Partial<LayerCrop>): ClipEditsV2 {
  if (!isMediaLayerTarget(target)) return edits
  const map: Record<keyof LayerCrop, CropProp> = { l: 'cropL', t: 'cropT', r: 'cropR', b: 'cropB' }
  let next = edits
  for (const k of Object.keys(crop) as (keyof LayerCrop)[]) {
    const v = crop[k]
    if (v == null || !Number.isFinite(v)) continue
    next = setPropertyAt(next, target, map[k], localMs, v)
  }
  return next
}

/** Screen-space crop (what the user drags) ↔ media-space crop (what is stored), given the flip. */
export function screenToMediaCrop(c: LayerCrop, f: { h: boolean; v: boolean }): LayerCrop {
  return { l: f.h ? c.r : c.l, r: f.h ? c.l : c.r, t: f.v ? c.b : c.t, b: f.v ? c.t : c.b }
}
export const mediaToScreenCrop = screenToMediaCrop

// ---------------------------------------------------------------------------
// Stacking order (bring forward / send backward)
// ---------------------------------------------------------------------------

export type StackKind = 'broll' | 'text'
export type StackItem = { id: string; startMs: number; endMs: number }

export function stackKindOf(target: KeyframeTarget): StackKind | null {
  if (target.startsWith('broll:')) return 'broll'
  if (target.startsWith('text:')) return 'text'
  return null
}

export function stackItems(edits: ClipEditsV2, kind: StackKind): StackItem[] {
  const src = kind === 'broll' ? edits.broll ?? [] : edits.textItems ?? []
  return src.map((it) => ({ id: it.id, startMs: it.startMs, endMs: it.endMs }))
}

/** Bottom → top order the preview draws and the worker composites. */
export function orderedStack<T extends StackItem>(edits: ClipEditsV2, kind: StackKind, items: readonly T[]): T[] {
  return stackOrder(items, (id) => layerZ(edits, `${kind}:${id}` as KeyframeTarget))
}

function overlaps(a: StackItem, b: StackItem): boolean {
  return a.startMs < b.endMs - STACK_OVERLAP_TOL_MS && b.startMs < a.endMs - STACK_OVERLAP_TOL_MS
}

export type StackMove = 'forward' | 'backward' | 'front' | 'back'

/** Items the selected one shares the screen with at some point (same kind, time overlap). */
export function stackNeighbours(edits: ClipEditsV2, target: KeyframeTarget): StackItem[] {
  const kind = stackKindOf(target)
  if (!kind) return []
  const items = stackItems(edits, kind)
  const me = items.find((i) => `${kind}:${i.id}` === target)
  if (!me) return []
  return items.filter((i) => i.id !== me.id && overlaps(i, me))
}

/**
 * Re-stack the selected layer among the layers it overlaps. Rewrites z for that group only
 * (0..n-1, bottom → top), so the result is exact and survives undo / save.
 */
export function moveInStack(edits: ClipEditsV2, target: KeyframeTarget, move: StackMove): ClipEditsV2 {
  const kind = stackKindOf(target)
  if (!kind) return edits
  const items = stackItems(edits, kind)
  const me = items.find((i) => `${kind}:${i.id}` === target)
  if (!me) return edits
  const group = items.filter((i) => i.id === me.id || overlaps(i, me))
  if (group.length < 2) return edits
  const order = orderedStack(edits, kind, group)
  const at = order.findIndex((i) => i.id === me.id)
  const next = order.filter((i) => i.id !== me.id)
  const to = move === 'front' ? next.length : move === 'back' ? 0 : move === 'forward' ? Math.min(next.length, at + 1) : Math.max(0, at - 1)
  if (to === at) return edits
  next.splice(to, 0, me)
  let out = edits
  next.forEach((it, i) => {
    out = withLayerProp(out, `${kind}:${it.id}` as KeyframeTarget, { z: i === 0 ? undefined : i })
  })
  return out
}

/** Which stack moves are possible (inspector / context menu enablement). */
export function stackMoves(edits: ClipEditsV2, target: KeyframeTarget): Record<StackMove, boolean> {
  const kind = stackKindOf(target)
  const none = { forward: false, backward: false, front: false, back: false }
  if (!kind) return none
  const items = stackItems(edits, kind)
  const me = items.find((i) => `${kind}:${i.id}` === target)
  if (!me) return none
  const group = items.filter((i) => i.id === me.id || overlaps(i, me))
  if (group.length < 2) return none
  const order = orderedStack(edits, kind, group)
  const at = order.findIndex((i) => i.id === me.id)
  const top = at === order.length - 1
  const bottom = at === 0
  return { forward: !top, front: !top, backward: !bottom, back: !bottom }
}

/** Drop layerProps rows whose layer no longer exists (delete / undo). */
export function pruneLayerProps(edits: ClipEditsV2): ClipEditsV2 {
  if (!edits.layerProps?.length) return edits
  const ok = new Set<string>(['video', ...(edits.broll ?? []).map((b) => `broll:${b.id}`), ...(edits.textItems ?? []).map((t) => `text:${t.id}`)])
  const keep = edits.layerProps.filter((p) => ok.has(p.target))
  return keep.length === edits.layerProps.length ? edits : { ...edits, layerProps: keep.length ? keep : undefined }
}
