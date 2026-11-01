/** TC3 canvas helpers. */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { findTrack } from './keyframes'
import type { KeyframeTarget } from './motion-schema'

const wrap = (v: number) => (v > 360 ? v - 360 : v < -360 ? v + 360 : v)

/**
 * TC3 (CV-07): rotate a layer by ±90° — the static rotation, or every rotation keyframe by the same
 * amount (the animation keeps its shape). Same keyframe field the canvas handle writes → preview = export.
 */
export function rotateBy90(edits: ClipEditsV2, target: KeyframeTarget, dir: 1 | -1): ClipEditsV2 {
  const d = 90 * dir
  const tr = findTrack(edits, target, 'rotation')
  const rest = (edits.keyframes ?? []).filter((k) => !(k.target === target && k.prop === 'rotation'))
  const next = tr?.points.length
    ? { ...tr, points: tr.points.map((p) => ({ ...p, v: wrap(p.v + d) })) }
    : { ...(tr ?? { target, prop: 'rotation' as const, points: [] }), value: wrap((tr?.value ?? 0) + d) }
  const keep = next.points.length || (next.value ?? 0) !== 0
  const list = keep ? [...rest, next] : rest
  return { ...edits, keyframes: list.length ? list : undefined }
}
