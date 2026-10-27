import type { ClipEditsV2 } from '@/lib/clips/edits'

/** Match worker `MAX_TRIM_EXTEND_MS` — export may include extra source beyond AI clip bounds. */
export const MAX_TRIM_EXTEND_MS = 8000

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
