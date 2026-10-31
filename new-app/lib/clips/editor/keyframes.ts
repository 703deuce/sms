/**
 * E3 keyframes: shared interpolation math + edit operations.
 * Mirrored 1:1 by worker/clips_worker/motion.py (parity fixture: worker/tests/fixtures/motion_parity.json).
 */
import type { BrollItem } from '@/lib/clips/broll'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import {
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
      return a.v + (b.v - a.v) * easeValue(a.ease, (t - a.tMs) / span)
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
  if (target === 'music') return edits.audio?.music?.startMs ?? 0
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
  return tracksFor(edits, target).some((t) => t.points.length > 0 || (t.value != null && t.value !== PROP_SPECS[t.prop].def))
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
