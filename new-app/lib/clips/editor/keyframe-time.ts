/**
 * Keyframes are stored in EDIT ms (output timeline before export speed post). Segment-speed curves
 * warp edit→real like the preview playbackRate + export post-step. UI that scrubs on the warped
 * clock or draws on a warped lane must convert through the same pieces as speedWarpPieces.
 */
import { displayPositionMs, editMsAtDisplayMs, normalizeEditSpeed, orderedKeepSegments, type ClipEditsV2 } from '@/lib/clips/edits'
import {
  hasSpeedChange,
  speedWarpPieces,
  unwarpMs,
  warpMs,
  type WarpPiece,
} from '@/lib/clips/editor/speed'

export function keyframeWarpPieces(edits: ClipEditsV2): WarpPiece[] {
  return speedWarpPieces(orderedKeepSegments(edits), edits.segmentSpeeds)
}

export function keyframesUseSegmentWarp(edits: ClipEditsV2): boolean {
  const p = keyframeWarpPieces(edits)
  return Boolean(edits.segmentSpeeds?.length && hasSpeedChange(p))
}

/** True when playhead ↔ keyframe mapping must go through the export/display clock (segment speed, global speed, inserts). */
export function keyframeTimingActive(edits: ClipEditsV2): boolean {
  return (
    keyframesUseSegmentWarp(edits) ||
    (normalizeEditSpeed(edits.speed) ?? 1) !== 1 ||
    Boolean(edits.inserts?.length)
  )
}

/** Playhead (stored edit ms) → absolute edit ms to read/write keyframes (matches caption/overlay edit time). */
export function keyframeGlobalEditMs(edits: ClipEditsV2, playheadMs: number): number {
  if (!keyframeTimingActive(edits)) return playheadMs
  return editMsAtDisplayMs(edits, displayPositionMs(edits, playheadMs))
}

/** Playhead → item-local edit ms for keyframe inspector, auto-key, canvas gestures, and preview sampling. */
export function keyframeLocalEditFromPlayhead(edits: ClipEditsV2, playheadMs: number, originMs: number): number {
  return Math.max(0, keyframeGlobalEditMs(edits, playheadMs) - originMs)
}

/** Edit ms → segment-real ms (identity when no segment speed). */
export function keyframeRealMs(edits: ClipEditsV2, editMs: number): number {
  if (!keyframesUseSegmentWarp(edits)) return editMs
  return warpMs(keyframeWarpPieces(edits), Math.max(0, editMs))
}

/** Segment-real ms → edit ms for storage / interpolation (identity when no segment speed). */
export function keyframeEditMs(edits: ClipEditsV2, realMs: number): number {
  if (!keyframesUseSegmentWarp(edits)) return realMs
  return unwarpMs(keyframeWarpPieces(edits), Math.max(0, realMs))
}

/** Item-local edit keyframe time → horizontal fraction on a lane/item [localFrom, localTo]. */
export function keyframeLaneFraction(
  edits: ClipEditsV2,
  originMs: number,
  localFromMs: number,
  localToMs: number,
  localEditMs: number,
): number {
  const a = originMs + localFromMs
  const b = originMs + localToMs
  const t = originMs + localEditMs
  if (!keyframesUseSegmentWarp(edits)) {
    const len = Math.max(1, localToMs - localFromMs)
    return (localEditMs - localFromMs) / len
  }
  const p = keyframeWarpPieces(edits)
  const r0 = warpMs(p, a)
  const r1 = warpMs(p, b)
  const rt = warpMs(p, t)
  const span = Math.max(1e-6, r1 - r0)
  return (rt - r0) / span
}

/** Inverse of keyframeLaneFraction: lane fraction → item-local edit ms. */
export function keyframeLocalEditFromLaneFraction(
  edits: ClipEditsV2,
  originMs: number,
  localFromMs: number,
  localToMs: number,
  frac: number,
): number {
  const f = Math.min(1, Math.max(0, frac))
  if (!keyframesUseSegmentWarp(edits)) {
    return localFromMs + f * (localToMs - localFromMs)
  }
  const p = keyframeWarpPieces(edits)
  const a = originMs + localFromMs
  const b = originMs + localToMs
  const r0 = warpMs(p, a)
  const r1 = warpMs(p, b)
  const real = r0 + f * (r1 - r0)
  return Math.max(localFromMs, Math.min(localToMs, keyframeEditMs(edits, real) - originMs))
}

/** Map item-local edit ms → x offset in px inside an item lane (width = item edit width). */
export function keyframeDiamondLeftPx(
  edits: ClipEditsV2,
  originMs: number,
  itemStartMs: number,
  itemEndMs: number,
  itemWidthPx: number,
  localEditMs: number,
): number {
  const localFrom = itemStartMs - originMs
  const localTo = itemEndMs - originMs
  return keyframeLaneFraction(edits, originMs, localFrom, localTo, localEditMs) * itemWidthPx
}

/** Map x inside item lane → item-local edit ms (inverse of keyframeDiamondLeftPx). */
export function keyframeLocalEditFromDiamondPx(
  edits: ClipEditsV2,
  originMs: number,
  itemStartMs: number,
  itemEndMs: number,
  itemWidthPx: number,
  xPx: number,
): number {
  const localFrom = itemStartMs - originMs
  const localTo = itemEndMs - originMs
  const frac = xPx / Math.max(1, itemWidthPx)
  return keyframeLocalEditFromLaneFraction(edits, originMs, localFrom, localTo, frac)
}
