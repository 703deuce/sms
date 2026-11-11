import type { ClipEditsV2 } from '@/lib/clips/edits'
import { layerTransformAt, sourceSegmentTarget, tracksFor } from '@/lib/clips/editor/keyframes'
import {
  normalizeSourceSegmentTransform,
  sourceSegmentTransformCss,
  type SourceSegment,
  type SourceSegmentTransform,
} from '@/lib/clips/editor/sources'

/**
 * B3B source-slot motion. The static source-segment transform remains the baseline; authored/user
 * keyframes are item-local deltas on the real source segment. This keeps IDs/time mapping stable
 * when the slot moves while preserving legacy segments byte-for-byte when no source keyframes exist.
 */
export function sourceSegmentMotionTransform(
  edits: Pick<ClipEditsV2, 'keyframes'>,
  seg: Pick<SourceSegment, 'id' | 'startMs' | 'transform'>,
  sourceMs: number,
): SourceSegmentTransform | undefined {
  const target = sourceSegmentTarget(seg.id)
  if (!tracksFor(edits as ClipEditsV2, target).length) return normalizeSourceSegmentTransform(seg.transform)
  const base = normalizeSourceSegmentTransform(seg.transform) ?? {}
  const kf = layerTransformAt(edits as ClipEditsV2, target, Math.max(0, sourceMs - seg.startMs))
  const scale = (base.scale ?? 100) * kf.scale / 100
  const out: SourceSegmentTransform = {
    ...(Math.abs((base.x ?? 0) + kf.x) >= 0.001 ? { x: (base.x ?? 0) + kf.x } : {}),
    ...(Math.abs((base.y ?? 0) + kf.y) >= 0.001 ? { y: (base.y ?? 0) + kf.y } : {}),
    ...(Math.abs(scale - 100) >= 0.001 ? { scale } : {}),
    ...(Math.abs((base.rotation ?? 0) + kf.rotation) >= 0.001 ? { rotation: (base.rotation ?? 0) + kf.rotation } : {}),
    ...(base.cropL ? { cropL: base.cropL } : {}),
    ...(base.cropT ? { cropT: base.cropT } : {}),
    ...(base.cropR ? { cropR: base.cropR } : {}),
    ...(base.cropB ? { cropB: base.cropB } : {}),
  }
  return normalizeSourceSegmentTransform(out)
}

export function sourceSegmentMotionCss(
  edits: Pick<ClipEditsV2, 'keyframes'>,
  seg: Pick<SourceSegment, 'id' | 'startMs' | 'transform'>,
  sourceMs: number,
) {
  return sourceSegmentTransformCss(sourceSegmentMotionTransform(edits, seg, sourceMs))
}
