import type { ClipEditsV2 } from '@/lib/clips/edits'

/** Match worker `MAX_TRIM_EXTEND_MS` — export may include extra source beyond AI clip bounds. */
export const MAX_TRIM_EXTEND_MS = 8000
export const SHOW_SURROUNDING_CONTEXT_MS = 60_000
export const MAX_EDITOR_WORDS_CONTEXT_MS = 120_000

export function extendedTrimLimits(
  clipStartMs: number,
  clipEndMs: number,
  limits?: { minMs?: number; maxMs?: number },
) {
  if (limits?.minMs != null && limits?.maxMs != null) {
    return { minInMs: limits.minMs, maxOutMs: limits.maxMs }
  }
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
  limits?: { minMs?: number; maxMs?: number },
): { in: number; out: number } {
  const { minInMs, maxOutMs } = extendedTrimLimits(clipStartMs, clipEndMs, limits)
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

/** Also clamp trim handles to clean segment / composite media bounds when set. */
export function clampTrimWithMediaBounds(
  clipStartMs: number,
  clipEndMs: number,
  trim: { in: number; out: number },
  mediaMinMs?: number,
  mediaMaxMs?: number,
  limits?: { minMs?: number; maxMs?: number },
): { in: number; out: number } {
  const mergedLimits =
    limits?.minMs != null && limits?.maxMs != null
      ? limits
      : mediaMinMs != null && mediaMaxMs != null
        ? { minMs: mediaMinMs, maxMs: mediaMaxMs }
        : undefined
  let next = clampTrimToExtendedBounds(clipStartMs, clipEndMs, trim, mergedLimits)
  if (mediaMinMs != null) next = { ...next, in: Math.max(next.in, mediaMinMs) }
  if (mediaMaxMs != null) next = { ...next, out: Math.min(next.out, mediaMaxMs) }
  if (next.out - next.in < 500) {
    return clampTrimToExtendedBounds(clipStartMs, clipEndMs, trim, mergedLimits)
  }
  return next
}

export function expandedSourceCutMs(
  clipStartMs: number,
  clipEndMs: number,
  edits: Pick<ClipEditsV2, 'trim'>,
  limits?: { minMs?: number; maxMs?: number },
): { cutStartMs: number; cutEndMs: number } {
  const tin = edits.trim.in
  const tout = edits.trim.out
  const { minInMs: lo, maxOutMs: hi } = extendedTrimLimits(clipStartMs, clipEndMs, limits)
  const cutStartMs = Math.max(lo, Math.min(clipStartMs, tin))
  const cutEndMs = Math.min(hi, Math.max(clipEndMs, tout))
  if (cutEndMs <= cutStartMs) {
    return { cutStartMs: clipStartMs, cutEndMs: clipEndMs }
  }
  return { cutStartMs, cutEndMs }
}
