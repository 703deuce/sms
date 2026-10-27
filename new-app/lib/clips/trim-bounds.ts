import type { ClipEditsV2 } from '@/lib/clips/edits'

/** Match worker `MAX_TRIM_EXTEND_MS` — export may include extra source beyond AI clip bounds. */
export const MAX_TRIM_EXTEND_MS = 8000

export function extendedTrimLimits(clipStartMs: number, clipEndMs: number) {
  return {
    minInMs: Math.max(0, clipStartMs - MAX_TRIM_EXTEND_MS),
    maxOutMs: clipEndMs + MAX_TRIM_EXTEND_MS,
  }
}

/** Clamp editor trim handles to the 8s extend window on each side of the AI clip. */
export function clampTrimToExtendedBounds(
  clipStartMs: number,
  clipEndMs: number,
  trim: { in: number; out: number },
): { in: number; out: number } {
  const { minInMs, maxOutMs } = extendedTrimLimits(clipStartMs, clipEndMs)
  let tin = Math.max(minInMs, Math.min(maxOutMs, trim.in))
  let tout = Math.max(minInMs, Math.min(maxOutMs, trim.out))
  const minSpan = 500
  if (tout - tin < minSpan) {
    if (tin + minSpan <= maxOutMs) tout = tin + minSpan
    else tin = Math.max(minInMs, tout - minSpan)
  }
  if (tout <= tin) {
    return { in: clipStartMs, out: clipEndMs }
  }
  return { in: Math.round(tin), out: Math.round(tout) }
}

export function expandedSourceCutMs(
  clipStartMs: number,
  clipEndMs: number,
  edits: Pick<ClipEditsV2, 'trim'>,
): { cutStartMs: number; cutEndMs: number } {
  const tin = edits.trim.in
  const tout = edits.trim.out
  const lo = Math.max(0, clipStartMs - MAX_TRIM_EXTEND_MS)
  const hi = clipEndMs + MAX_TRIM_EXTEND_MS
  const cutStartMs = Math.max(lo, Math.min(clipStartMs, tin))
  const cutEndMs = Math.min(hi, Math.max(clipEndMs, tout))
  if (cutEndMs <= cutStartMs) {
    return { cutStartMs: clipStartMs, cutEndMs: clipEndMs }
  }
  return { cutStartMs, cutEndMs }
}
