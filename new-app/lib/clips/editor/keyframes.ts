/**
 * E3 keyframes: shared interpolation math + edit operations.
 * Mirrored 1:1 by worker/clips_worker/motion.py (parity fixture: worker/tests/fixtures/motion_parity.json).
 */
import type { BrollItem } from '@/lib/clips/broll'
import { MASK_MAX_KEYS, maskGeomAt, type LayerFx } from '@/lib/clips/editor/layer-fx'
import { reconcileTracks } from '@/lib/clips/editor/tracks'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import {
  EASE_BZ,
  isColorProp,
  normalizeBz,
  PROP_SPECS,
  propsForTarget,
  type Ease,
  type KeyPoint,
  type KeyProp,
  type KeyframeTarget,
  type KeyframeTrack,
} from '@/lib/clips/editor/motion-schema'

export * from '@/lib/clips/editor/motion-schema'

// ---------------------------------------------------------------------------
// Interpolation (identical in motion.py and in the ffmpeg expressions it emits)
// ---------------------------------------------------------------------------

export function easeValue(ease: Ease | undefined, u: number): number {
  const x = Math.min(1, Math.max(0, u))
  switch (ease) {
    case 'in':
      return x * x
    case 'out':
      return x * (2 - x)
    case 'inOut':
      return x * x * (3 - 2 * x)
    default:
      return x
  }
}

/** KF-15: segment shape of point `a` (bz wins over ease). Same Horner form as motion.py. */
export function pointEase(a: KeyPoint, u: number): number {
  if (!a.bz) return easeValue(a.ease, u)
  const x = Math.min(1, Math.max(0, u))
  const [p, q] = a.bz
  const c1 = 3 * p
  const c2 = 3 * q - 6 * p
  const c3 = 1 + 3 * p - 3 * q
  return x * (c1 + x * (c2 + x * c3))
}

/** Value of a sorted point list at local time t (holds before the first / after the last point). */
export function valueAtPoints(points: readonly KeyPoint[], t: number, def: number): number {
  const n = points.length
  if (!n) return def
  if (t <= points[0]!.tMs) return points[0]!.v
  const last = points[n - 1]!
  if (t >= last.tMs) return last.v
  for (let i = 0; i < n - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    if (t < b.tMs) {
      const span = b.tMs - a.tMs
      if (span <= 0) return b.v
      return a.v + (b.v - a.v) * pointEase(a, (t - a.tMs) / span)
    }
  }
  return last.v
}

export function trackValueAt(track: KeyframeTrack | undefined, prop: KeyProp, t: number): number {
  const def = PROP_SPECS[prop].def
  if (!track) return def
  if (!track.points.length) return track.value ?? def
  return valueAtPoints(track.points, t, def)
}

export function findTrack(edits: ClipEditsV2, target: KeyframeTarget, prop: KeyProp): KeyframeTrack | undefined {
  return edits.keyframes?.find((k) => k.target === target && k.prop === prop)
}

export function tracksFor(edits: ClipEditsV2, target: KeyframeTarget): KeyframeTrack[] {
  return (edits.keyframes ?? []).filter((k) => k.target === target)
}

/** Timeline lane item → keyframe target (SFX has none). */
export function targetForItem(lane: string, id: string): KeyframeTarget | null {
  if (lane === 'video') return 'video'
  if (lane === 'voice') return 'voice'
  if (lane === 'music') return 'music'
  if (lane === 'text') return id === 'hook' ? 'text' : `text:${id}`
  if (lane === 'broll') return `broll:${id}`
  if (lane === 'sfx') return `sfx:${id}` // G1b3: volume envelope
  if (lane === 'adjust') return `adjust:${id}` // G4a: color keyframes
  return null
}

export function brollIdOf(target: KeyframeTarget): string | null {
  return target.startsWith('broll:') ? target.slice(6) : null
}

/** E4 text item id of a `text:<id>` target. */
export function textItemIdOf(target: KeyframeTarget): string | null {
  return target.startsWith('text:') ? target.slice(5) : null
}

/** Output ms of the target's local time 0. */
export function targetOriginMs(edits: ClipEditsV2, target: KeyframeTarget): number {
  const bid = brollIdOf(target)
  if (bid) return edits.broll?.find((b) => b.id === bid)?.startMs ?? 0
  const tid = textItemIdOf(target)
  if (tid) return edits.textItems?.find((t) => t.id === tid)?.startMs ?? 0
  if (target.startsWith('adjust:')) return edits.adjustLayers?.find((a) => a.id === target.slice(7))?.startMs ?? 0
  if (target === 'music') return edits.audio?.music?.startMs ?? 0
  if (target.startsWith('sfx:')) return edits.audio?.sfx?.find((s) => s.generationId === target.slice(4))?.atMs ?? 0
  return 0
}

export type LayerTransform = { x: number; y: number; scale: number; rotation: number; opacity: number }
export const IDENTITY_TRANSFORM: LayerTransform = { x: 0, y: 0, scale: 100, rotation: 0, opacity: 100 }

export function layerTransformAt(edits: ClipEditsV2, target: KeyframeTarget, localMs: number): LayerTransform {
  const v = (p: KeyProp) => trackValueAt(findTrack(edits, target, p), p, localMs)
  return { x: v('x'), y: v('y'), scale: v('scale'), rotation: v('rotation'), opacity: v('opacity') }
}

export function isIdentityTransform(t: LayerTransform): boolean {
  return t.x === 0 && t.y === 0 && t.scale === 100 && t.rotation === 0 && t.opacity === 100
}

/** Gain 0..1 for an audio target at local time. */
export function volumeAt(edits: ClipEditsV2, target: 'voice' | 'music', localMs: number): number {
  return trackValueAt(findTrack(edits, target, 'volume'), 'volume', localMs) / 100
}

/** True when a target has any non-default animation or static value. */
export function hasMotion(edits: ClipEditsV2, target: KeyframeTarget): boolean {
  // G4a: color tracks are read by the color pass, never by the motion chain.
  return tracksFor(edits, target).some((t) => !isColorProp(t.prop) && (t.points.length > 0 || (t.value != null && t.value !== PROP_SPECS[t.prop].def)))
}

/**
 * CSS for a frame-sized layer, origin = centre. Same affine map the worker builds:
 * centre + (x%·W, y%·H) + R(rotation, clockwise) · S(scale) · (p − centre).
 */
export function transformCss(t: LayerTransform, origin: 'center' | 'top' = 'center'): {
  transform: string
  transformOrigin: string
  opacity: number
} {
  return {
    transform: `translate(${t.x}%, ${t.y}%) rotate(${t.rotation}deg) scale(${t.scale / 100})`,
    transformOrigin: origin === 'top' ? '50% 0%' : '50% 50%',
    opacity: Math.max(0, Math.min(1, t.opacity / 100)),
  }
}

// ---------------------------------------------------------------------------
// Edit operations (each returns a new edits object → one undo step)
// ---------------------------------------------------------------------------

const KF_TOL_MS = 17 // half a frame at 30 fps: "the playhead is on this keyframe"

function withTrack(edits: ClipEditsV2, target: KeyframeTarget, prop: KeyProp, track: KeyframeTrack | null): ClipEditsV2 {
  const rest = (edits.keyframes ?? []).filter((k) => !(k.target === target && k.prop === prop))
  const spec = PROP_SPECS[prop]
  const keep = track && (track.points.length || (track.value != null && track.value !== spec.def))
  const list = keep ? [...rest, track!] : rest
  return { ...edits, keyframes: list.length ? list : undefined }
}

function clampV(prop: KeyProp, v: number): number {
  const s = PROP_SPECS[prop]
  return Math.round(Math.min(s.max, Math.max(s.min, v)) * 100) / 100
}

export function pointAt(track: KeyframeTrack | undefined, localMs: number, tol = KF_TOL_MS): KeyPoint | undefined {
  return track?.points.find((p) => Math.abs(p.tMs - localMs) <= tol)
}

/**
 * Inspector value change (CapCut): no keyframes → static value; keyframes exist → upsert a
 * keyframe at the playhead (auto-key).
 */
export function setPropertyAt(
  edits: ClipEditsV2,
  target: KeyframeTarget,
  prop: KeyProp,
  localMs: number,
  v: number,
): ClipEditsV2 {
  const tr = findTrack(edits, target, prop)
  const val = clampV(prop, v)
  if (!tr || !tr.points.length) return withTrack(edits, target, prop, { target, prop, value: val, points: [] })
  const hit = pointAt(tr, localMs)
  const t = hit ? hit.tMs : Math.round(localMs)
  const points = [...tr.points.filter((p) => p !== hit), { ...(hit ?? {}), tMs: t, v: val }].sort((a, b) => a.tMs - b.tMs)
  return withTrack(edits, target, prop, { ...tr, points })
}

/** ◇ button: add a keyframe with the current value at the playhead, or remove the one under it. */
export function toggleKeyframeAt(
  edits: ClipEditsV2,
  target: KeyframeTarget,
  prop: KeyProp,
  localMs: number,
): ClipEditsV2 {
  const tr = findTrack(edits, target, prop)
  const hit = pointAt(tr, localMs)
  if (tr && hit) {
    const points = tr.points.filter((p) => p !== hit)
    // Removing the last keyframe keeps its value as the static value (CapCut keeps the look).
    return withTrack(edits, target, prop, { ...tr, points, value: points.length ? tr.value : hit.v })
  }
  const v = trackValueAt(tr, prop, localMs)
  const points = [...(tr?.points ?? []), { tMs: Math.round(localMs), v }].sort((a, b) => a.tMs - b.tMs)
  return withTrack(edits, target, prop, { target, prop, ...(tr?.value != null ? { value: tr.value } : {}), points })
}

export function setKeyframeEase(
  edits: ClipEditsV2,
  target: KeyframeTarget,
  prop: KeyProp,
  localMs: number,
  ease: Ease,
): ClipEditsV2 {
  const tr = findTrack(edits, target, prop)
  const hit = pointAt(tr, localMs)
  if (!tr || !hit) return edits
  const points = tr.points.map((p) => (p === hit ? { tMs: p.tMs, v: p.v, ...(ease !== 'linear' ? { ease } : {}) } : p))
  return withTrack(edits, target, prop, { ...tr, points })
}

/** KF-15: custom curve on the key under localMs (normalized: preset-equal → ease). */
export function setKeyframeCurve(edits: ClipEditsV2, target: KeyframeTarget, prop: KeyProp, localMs: number, bz: [number, number]): ClipEditsV2 {
  const tr = findTrack(edits, target, prop)
  const hit = pointAt(tr, localMs)
  const nb = normalizeBz(bz)
  if (!tr || !hit || !nb) return edits
  const points = tr.points.map((p) => (p === hit ? { tMs: p.tMs, v: p.v, ...nb } : p))
  return withTrack(edits, target, prop, { ...tr, points })
}

/** Effective bz of a point (preset or custom), for drawing the graph. */
export function pointBz(p: KeyPoint): [number, number] {
  return p.bz ?? EASE_BZ[p.ease ?? 'linear']
}

/** All local keyframe times of a target (the diamonds on its timeline item). */
export function keyframeTimes(edits: ClipEditsV2, target: KeyframeTarget): number[] {
  const set = new Set<number>()
  for (const t of tracksFor(edits, target)) for (const p of t.points) set.add(p.tMs)
  return [...set].sort((a, b) => a - b)
}

/** Move every keyframe of `target` at `fromMs` to `toMs` (a diamond drag). */
export function moveKeyframesAt(edits: ClipEditsV2, target: KeyframeTarget, fromMs: number, toMs: number): ClipEditsV2 {
  const to = Math.round(toMs)
  if (Math.abs(to - fromMs) < 1) return edits
  let next = edits
  for (const tr of tracksFor(edits, target)) {
    const hit = pointAt(tr, fromMs, 1)
    if (!hit) continue
    const others = tr.points.filter((p) => p !== hit && Math.abs(p.tMs - to) >= 1)
    const points = [...others, { ...hit, tMs: to }].sort((a, b) => a.tMs - b.tMs)
    next = withTrack(next, target, tr.prop, { ...tr, points })
  }
  return next
}

export function deleteKeyframesAt(edits: ClipEditsV2, target: KeyframeTarget, tMs: number): ClipEditsV2 {
  let next = edits
  for (const tr of tracksFor(edits, target)) {
    const hit = pointAt(tr, tMs, 1)
    if (!hit) continue
    const points = tr.points.filter((p) => p !== hit)
    next = withTrack(next, target, tr.prop, { ...tr, points, value: points.length ? tr.value : hit.v })
  }
  return next
}

/** KF-18: move every key of `target` at any of `times` by delta (clamped so min ≥ 0). Returns new edits + new times. */
export function shiftKeyframeTimes(
  edits: ClipEditsV2,
  target: KeyframeTarget,
  times: readonly number[],
  deltaMs: number,
): { edits: ClipEditsV2; times: number[] } {
  if (!times.length) return { edits, times: [] }
  const d = Math.round(Math.max(deltaMs, -Math.min(...times)))
  if (Math.abs(d) < 1) return { edits, times: [...times] }
  const isSel = (t: number) => times.some((s) => Math.abs(s - t) < 1)
  let next = edits
  for (const tr of tracksFor(edits, target)) {
    const moved = tr.points.filter((p) => isSel(p.tMs)).map((p) => ({ ...p, tMs: p.tMs + d }))
    if (!moved.length) continue
    const kept = tr.points.filter((p) => !isSel(p.tMs) && !moved.some((m) => Math.abs(m.tMs - p.tMs) < 1))
    next = withTrack(next, target, tr.prop, { ...tr, points: [...kept, ...moved].sort((a, b) => a.tMs - b.tMs) })
  }
  return { edits: next, times: times.map((t) => Math.round(t + d)) }
}

/** KF-18: delete every key of `target` at any of `times` (last-key rule = deleteKeyframesAt). */
export function deleteKeyframeTimes(edits: ClipEditsV2, target: KeyframeTarget, times: readonly number[]): ClipEditsV2 {
  return times.reduce((e, t) => deleteKeyframesAt(e, target, t), edits)
}

/** KF-18: click / shift-click on a diamond → next selection. */
export function toggleKfSelection(
  sel: { target: KeyframeTarget; times: number[] } | null,
  target: KeyframeTarget,
  tMs: number,
  additive: boolean,
): { target: KeyframeTarget; times: number[] } {
  if (!additive || !sel || sel.target !== target) return { target, times: [tMs] }
  const has = sel.times.includes(tMs)
  const times = has ? sel.times.filter((t) => t !== tMs) : [...sel.times, tMs].sort((a, b) => a - b)
  return times.length ? { target, times } : { target, times: [tMs] }
}

/** KF-19: move one property's key (lane drag). */
export function moveTrackPoint(edits: ClipEditsV2, target: KeyframeTarget, prop: KeyProp, fromMs: number, toMs: number): ClipEditsV2 {
  const tr = findTrack(edits, target, prop)
  const hit = pointAt(tr, fromMs, 1)
  const to = Math.max(0, Math.round(toMs))
  if (!tr || !hit || Math.abs(to - hit.tMs) < 1) return edits
  const points = [...tr.points.filter((p) => p !== hit && Math.abs(p.tMs - to) >= 1), { ...hit, tMs: to }].sort((a, b) => a.tMs - b.tMs)
  return withTrack(edits, target, prop, { ...tr, points })
}

/** Previous / next keyframe time (any of the target's props, or one prop). */
export function adjacentKeyframe(
  edits: ClipEditsV2,
  target: KeyframeTarget,
  prop: KeyProp | null,
  localMs: number,
  dir: -1 | 1,
): number | null {
  const times = prop ? (findTrack(edits, target, prop)?.points ?? []).map((p) => p.tMs) : keyframeTimes(edits, target)
  const c = dir < 0 ? times.filter((t) => t < localMs - KF_TOL_MS).pop() : times.find((t) => t > localMs + KF_TOL_MS)
  return c ?? null
}

// ---------------------------------------------------------------------------
// Keeping keyframes on their content when items change (move / trim / split / delete)
// ---------------------------------------------------------------------------

function shiftTrack(t: KeyframeTrack, by: number, target: KeyframeTarget = t.target): KeyframeTrack {
  return { ...t, target, points: t.points.map((p) => ({ ...p, tMs: p.tMs + by })) }
}

/**
 * Local keyframe time is anchored to the item's media: local + inMs is constant. So a left-trim
 * (startMs += d, inMs += d) shifts points by −d, a move does nothing, and the right half of a
 * split inherits the parent's track shifted by its new in-point. Deleted items lose their tracks.
 * Split halves: left keeps the in-transition, right keeps the out-transition.
 */
export function reconcileItemMotion(prev: ClipEditsV2, next: ClipEditsV2): ClipEditsV2 {
  const tracks = next.keyframes ?? []
  const prevBroll = new Map((prev.broll ?? []).map((b) => [b.id, b]))
  const nextBroll = next.broll ?? []
  const nextIds = new Set(nextBroll.map((b) => b.id))
  let changed = false
  const out: KeyframeTrack[] = []
  for (const t of tracks) {
    const bid = brollIdOf(t.target)
    if (bid) {
      const n = nextBroll.find((b) => b.id === bid)
      if (!n) {
        changed = true
        continue
      }
      const p = prevBroll.get(bid)
      const by = p ? (p.inMs ?? 0) - (n.inMs ?? 0) : 0
      if (by) changed = true
      out.push(by ? shiftTrack(t, by) : t)
      continue
    }
    const tid = textItemIdOf(t.target)
    if (tid) {
      // E4: text keyframes are anchored to the frame content: a left-trim keeps them in place
      // (local shifts by −d); a move (start and end by the same delta) carries them along.
      const n = (next.textItems ?? []).find((x) => x.id === tid)
      if (!n) {
        changed = true
        continue
      }
      const p = (prev.textItems ?? []).find((x) => x.id === tid)
      const moved = p && p.endMs - p.startMs === n.endMs - n.startMs
      const by = p && !moved ? p.startMs - n.startMs : 0
      if (by) changed = true
      out.push(by ? shiftTrack(t, by) : t)
      continue
    }
    if (t.target.startsWith('adjust:')) {
      // G4a: adjustment-layer color keyframes behave like text: a left-trim keeps them on the
      // timeline (local shifts by −d), a move carries them, a deleted layer drops them.
      const aid = t.target.slice(7)
      const n = (next.adjustLayers ?? []).find((x) => x.id === aid)
      if (!n) {
        changed = true
        continue
      }
      const p = (prev.adjustLayers ?? []).find((x) => x.id === aid)
      const moved = p && p.endMs - p.startMs === n.endMs - n.startMs
      const by = p && !moved ? p.startMs - n.startMs : 0
      if (by) changed = true
      out.push(by ? shiftTrack(t, by) : t)
      continue
    }
    if (t.target.startsWith('sfx:')) {
      // G1b3: SFX envelopes are local to the SFX start (a move keeps them); deleted SFX drop theirs.
      if (!(next.audio?.sfx ?? []).some((s) => s.generationId === t.target.slice(4))) {
        changed = true
        continue
      }
      out.push(t)
      continue
    }
    if (t.target === 'music') {
      const pm = prev.audio?.music
      const nm = next.audio?.music
      if (!nm || (pm && pm.generationId !== nm.generationId)) {
        changed = true
        continue
      }
      const by = pm ? (pm.inMs ?? 0) - (nm.inMs ?? 0) : 0
      if (by) changed = true
      out.push(by ? shiftTrack(t, by) : t)
      continue
    }
    out.push(t)
  }
  // Split children: new ids whose origin (`<id>~…`) matches a previous item that contained them.
  let broll = nextBroll
  for (const child of nextBroll) {
    if (prevBroll.has(child.id) || !child.id.includes('~')) continue
    const origin = child.id.split('~')[0]!
    const parent = (prev.broll ?? []).find(
      (b) => b.id.split('~')[0] === origin && b.startMs < child.startMs && child.startMs < b.endMs && nextIds.has(b.id),
    )
    if (!parent) continue
    changed = true
    for (const t of tracks.filter((k) => k.target === `broll:${parent.id}`)) {
      out.push(shiftTrack(t, (parent.inMs ?? 0) - (child.inMs ?? 0), `broll:${child.id}`))
    }
    broll = broll.map((b) => {
      if (b.id === child.id && b.transitionIn) {
        const { transitionIn: _i, ...rest } = b
        return rest as BrollItem
      }
      if (b.id === parent.id && b.transitionOut) {
        const { transitionOut: _o, ...rest } = b
        return rest as BrollItem
      }
      return b
    })
  }
  // E4 text split children (`<id>~<atMs>`): inherit the parent's tracks shifted to the new start.
  const prevText = new Map((prev.textItems ?? []).map((x) => [x.id, x]))
  for (const child of next.textItems ?? []) {
    if (prevText.has(child.id) || !child.id.includes('~')) continue
    const origin = child.id.split('~')[0]!
    const parent = (prev.textItems ?? []).find(
      (x) => x.id.split('~')[0] === origin && x.startMs < child.startMs && child.startMs < x.endMs,
    )
    if (!parent) continue
    const kids = tracks.filter((k) => k.target === `text:${parent.id}`)
    if (kids.length) changed = true
    for (const t of kids) out.push(shiftTrack(t, parent.startMs - child.startMs, `text:${child.id}`))
  }
  if (!changed) return reconcileLayerProps(prev, next)
  return reconcileLayerProps(prev, { ...next, broll, keyframes: out.length ? out : undefined })
}

/**
 * G1a: flip / z rows follow their layer — split children (`<id>~…`) inherit the parent's row,
 * rows of deleted B-roll / text items are dropped. Untouched edits are returned as-is.
 */
export function reconcileLayerProps(prev: ClipEditsV2, next: ClipEditsV2): ClipEditsV2 {
  // G1b: track membership follows the same rules (split children inherit, deleted items drop).
  // G4c: G4b layer effects (mask / key / blend / reverse) follow the same rules.
  return reconcileTracks(prev, reconcileLayerFx(prev, reconcileLayerRows(prev, next)))
}

/**
 * G4c: `edits.layerFx` rows follow their B-roll item — rows of deleted items drop, split children
 * (`<id>~…`) inherit the parent's row with mask keys re-based to the child's start (the geometry
 * at the split point becomes the child's first key, so the mask does not jump). A reversed item
 * plays its range backwards, so a split re-assigns the source ranges: the left half shows the END
 * of the parent's range and the right half the start (inMs swap), keeping the picture continuous.
 */
export function reconcileLayerFx(prev: ClipEditsV2, next: ClipEditsV2): ClipEditsV2 {
  const rows = next.layerFx
  if (!rows?.length) return next
  const live = new Set<string>([
    'video',
    ...(next.broll ?? []).map((b) => `broll:${b.id}`),
    ...(next.textItems ?? []).map((t) => `text:${t.id}`),
    ...(next.adjustLayers ?? []).map((l) => `adjust:${l.id}`),
  ])
  let changed = false
  const out: LayerFx[] = rows.filter((r) => {
    const keep = live.has(r.target)
    if (!keep) changed = true
    return keep
  })
  const had = new Set(rows.map((r) => r.target))
  const prevBroll = prev.broll ?? []
  const prevIds = new Set(prevBroll.map((b) => b.id))
  const inFix = new Map<string, number>()
  for (const child of next.broll ?? []) {
    const tgt = `broll:${child.id}`
    if (prevIds.has(child.id) || !child.id.includes('~') || had.has(tgt)) continue
    const origin = child.id.split('~')[0]!
    const parent = prevBroll.find((x) => x.id.split('~')[0] === origin && x.startMs < child.startMs && child.startMs < x.endMs)
    const row = parent && rows.find((r) => r.target === `broll:${parent.id}`)
    if (!parent || !row) continue
    const I = parent.inMs ?? 0
    const c0 = Math.max(0, (child.inMs ?? 0) - I || child.startMs - parent.startMs)
    const copy: LayerFx = { ...row, target: tgt }
    if (row.mask) {
      const { keys, ...m } = row.mask
      if (keys?.length) {
        const at = maskGeomAt(row.mask, c0)
        const rest = keys.filter((k) => k.ms - c0 > 0).map((k) => ({ ...k, ms: k.ms - c0 }))
        copy.mask = { ...m, ...at, keys: [{ ms: 0, ...at }, ...rest].slice(0, MASK_MAX_KEYS) }
      } else copy.mask = { ...m }
    }
    out.push(copy)
    changed = true
    if (row.reverse) {
      const L = parent.endMs - parent.startMs
      const left = (next.broll ?? []).find((b) => b.id === parent.id)
      const Lr = child.endMs - child.startMs
      if (left) inFix.set(left.id, I + L - (left.endMs - left.startMs))
      inFix.set(child.id, Math.max(I, I + L - c0 - Lr))
    }
  }
  if (!changed) return next
  const broll = inFix.size
    ? (next.broll ?? []).map((b) => (inFix.has(b.id) ? ({ ...b, inMs: Math.round(inFix.get(b.id)!) } as BrollItem) : b))
    : next.broll
  return { ...next, broll, layerFx: out.length ? out : undefined }
}

function reconcileLayerRows(prev: ClipEditsV2, next: ClipEditsV2): ClipEditsV2 {
  const rows = next.layerProps
  if (!rows?.length) return next
  const live = new Set<string>([
    'video',
    ...(next.broll ?? []).map((b) => `broll:${b.id}`),
    ...(next.textItems ?? []).map((t) => `text:${t.id}`),
  ])
  const had = new Set(rows.map((r) => r.target))
  let changed = false
  const out = rows.filter((r) => {
    const keep = live.has(r.target)
    if (!keep) changed = true
    return keep
  })
  const inherit = (kind: 'broll' | 'text', prevItems: { id: string; startMs: number; endMs: number }[], nextItems: { id: string; startMs: number }[]) => {
    const prevIds = new Set(prevItems.map((x) => x.id))
    for (const child of nextItems) {
      const tgt = `${kind}:${child.id}`
      if (prevIds.has(child.id) || !child.id.includes('~') || had.has(tgt)) continue
      const origin = child.id.split('~')[0]!
      const parent = prevItems.find((x) => x.id.split('~')[0] === origin && x.startMs < child.startMs && child.startMs < x.endMs)
      const row = parent && rows.find((r) => r.target === `${kind}:${parent.id}`)
      if (!row) continue
      out.push({ ...row, target: tgt as KeyframeTarget })
      changed = true
    }
  }
  inherit('broll', prev.broll ?? [], next.broll ?? [])
  inherit('text', prev.textItems ?? [], next.textItems ?? [])
  if (!changed) return next
  return { ...next, layerProps: out.length ? out : undefined }
}

/** E2 ripple hook: output-time (video / voice) keyframes follow their source content. */
export function rippleGlobalKeyframes(
  tracks: KeyframeTrack[] | undefined,
  mapStart: (outMs: number) => number,
): KeyframeTrack[] | undefined {
  if (!tracks?.length) return tracks
  let changed = false
  const out = tracks.map((t) => {
    if (t.target !== 'video' && t.target !== 'voice') return t
    const byT = new Map<number, KeyPoint>()
    for (const p of t.points) {
      const m = mapStart(p.tMs)
      if (m !== p.tMs) changed = true
      byT.set(m, { ...p, tMs: m })
    }
    return { ...t, points: [...byT.values()].sort((a, b) => a.tMs - b.tMs) }
  })
  return changed ? out : tracks
}

export function targetsWithKeyframes(edits: ClipEditsV2): KeyframeTarget[] {
  return [...new Set((edits.keyframes ?? []).map((k) => k.target))]
}

export { propsForTarget }
