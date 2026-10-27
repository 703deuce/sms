/** Canonical segment key for clip idempotency (matches worker `clip_segment_key`). */
export function formatClipSegmentKey(startMs: number, endMs: number): string {
  return `${Math.trunc(startMs)}:${Math.trunc(endMs)}`
}
