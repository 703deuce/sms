/**
 * G1b: Vegas-style envelopes (rubber bands) on timeline items, backed by the E3 keyframe model:
 * opacity on visual layers (main video, B-roll / overlays, text items), volume on Voice (the video's
 * audio) and Music. A point IS a keyframe of that one property (linear between points, like Vegas'
 * default), so the inspector ◇ rows, the canvas and the export (motion.py / sendcmd) stay in sync.
 * Slope between two points = fade speed.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { findTrack, targetForItem, targetOriginMs, trackValueAt } from '@/lib/clips/editor/keyframes'
import { PROP_SPECS, propsForTarget, type KeyPoint, type KeyProp, type KeyframeTarget, type KeyframeTrack } from '@/lib/clips/editor/motion-schema'

export type EnvelopeKind = 'opacity' | 'volume'
export const ENVELOPE_TOL_MS = 5

/** The envelope a timeline item shows (null: none — SFX, hook title). */
export function envelopeFor(lane: string, id: string): { target: KeyframeTarget; prop: EnvelopeKind } | null {
  if (lane === 'text' && id === 'hook') return null
  // F14: Video opacity and Voice volume are independent properties and targets.
  // Earlier versions exposed the Voice keyframes on both lanes, so dragging
  // a Voice point also moved the apparent Video envelope.
  if (lane === 'video') return { target: 'video', prop: 'opacity' }
  const target = targetForItem(lane, id)
  if (!target) return null
  const props = propsForTarget(target)
  if (props.includes('volume')) return { target, prop: 'volume' }
  if (props.includes('opacity')) return { target, prop: 'opacity' }
  return null
}

function put(edits: ClipEditsV2, target: KeyframeTarget, prop: KeyProp, track: KeyframeTrack | null): ClipEditsV2 {
  const rest = (edits.keyframes ?? []).filter((k) => !(k.target === target && k.prop === prop))
  const keep = track && (track.points.length || (track.value != null && track.value !== PROP_SPECS[prop].def))
  const list = keep ? [...rest, track!] : rest
  return { ...edits, keyframes: list.length ? list : undefined }
}

/** Index of the point nearest t within the tolerance (-1: none). */
function nearest(points: readonly KeyPoint[], t: number): number {
  let best = -1
  for (let i = 0; i < points.length; i++) {
    const d = Math.abs(points[i]!.tMs - t)
    if (d <= ENVELOPE_TOL_MS && (best < 0 || d < Math.abs(points[best]!.tMs - t))) best = i
  }
  return best
}

const clampV = (prop: KeyProp, v: number) => {
  const s = PROP_SPECS[prop]
  return Math.round(Math.min(s.max, Math.max(s.min, v)) * 100) / 100
}

/** Points in LOCAL ms of the target (see keyframes.targetOriginMs) + the flat value when none. */
export function envelopePoints(edits: ClipEditsV2, target: KeyframeTarget, prop: EnvelopeKind): { points: KeyPoint[]; flat: number } {
  const tr = findTrack(edits, target, prop)
  return { points: tr?.points ?? [], flat: tr?.value ?? PROP_SPECS[prop].def }
}

export function envelopeValueAt(edits: ClipEditsV2, target: KeyframeTarget, prop: EnvelopeKind, localMs: number): number {
  return trackValueAt(findTrack(edits, target, prop), prop, localMs)
}

/** Click on the line: a point at the line's current value (nothing changes until it is dragged). */
export function addEnvelopePoint(edits: ClipEditsV2, target: KeyframeTarget, prop: EnvelopeKind, localMs: number, v?: number): ClipEditsV2 {
  const tr = findTrack(edits, target, prop)
  const t = Math.max(0, Math.round(localMs))
  if (tr?.points.some((p) => Math.abs(p.tMs - t) <= ENVELOPE_TOL_MS)) return edits
  const val = clampV(prop, v ?? trackValueAt(tr, prop, t))
  const points = [...(tr?.points ?? []), { tMs: t, v: val }].sort((a, b) => a.tMs - b.tMs)
  return put(edits, target, prop, { target, prop, ...(tr?.value != null ? { value: tr.value } : {}), points })
}

/**
 * Drag a point: time stays between its neighbours (points never cross), value clamps to the
 * property range. Ease is kept (linear unless set in the inspector).
 */
export function moveEnvelopePoint(
  edits: ClipEditsV2,
  target: KeyframeTarget,
  prop: EnvelopeKind,
  fromMs: number,
  toMs: number,
  v: number,
): ClipEditsV2 {
  const tr = findTrack(edits, target, prop)
  if (!tr) return edits
  const i = nearest(tr.points, fromMs)
  if (i < 0) return edits
  const lo = i > 0 ? tr.points[i - 1]!.tMs + 1 : 0
  const hi = i < tr.points.length - 1 ? tr.points[i + 1]!.tMs - 1 : Number.POSITIVE_INFINITY
  const t = Math.round(Math.min(hi, Math.max(lo, toMs)))
  const points = tr.points.map((p, k) => (k === i ? { ...p, tMs: t, v: clampV(prop, v) } : p))
  return put(edits, target, prop, { ...tr, points })
}

/** Remove a point; removing the last one keeps its value flat (like the ◇ toggle). */
export function deleteEnvelopePoint(edits: ClipEditsV2, target: KeyframeTarget, prop: EnvelopeKind, tMs: number): ClipEditsV2 {
  const tr = findTrack(edits, target, prop)
  if (!tr) return edits
  const hit = tr.points[nearest(tr.points, tMs)]
  if (!hit) return edits
  const points = tr.points.filter((p) => p !== hit)
  return put(edits, target, prop, { ...tr, points, value: points.length ? tr.value : hit.v })
}

/** Reset the envelope to flat 100 % (Vegas "reset all"). */
export function resetEnvelope(edits: ClipEditsV2, target: KeyframeTarget, prop: EnvelopeKind): ClipEditsV2 {
  return put(edits, target, prop, null)
}

export { targetOriginMs }
