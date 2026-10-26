/** Cross-chunk clip dedupe by temporal IoU (unit-tested). */

export type TimeClip = { id: string; startMs: number; endMs: number; score: number }

export function clipTemporalIou(a: { startMs: number; endMs: number }, b: { startMs: number; endMs: number }): number {
  const inter = Math.max(0, Math.min(a.endMs, b.endMs) - Math.max(a.startMs, b.startMs))
  const union = Math.max(a.endMs, b.endMs) - Math.min(a.startMs, b.startMs)
  return union > 0 ? inter / union : 0
}

/** Keep highest-score clip per overlap cluster (IoU > threshold). */
export function dedupeClipsByTime(clips: TimeClip[], iouThreshold = 0.3): { kept: TimeClip[]; removedIds: string[] } {
  const sorted = [...clips].sort((a, b) => b.score - a.score)
  const kept: TimeClip[] = []
  const removedIds: string[] = []
  for (const c of sorted) {
    if (kept.some((k) => clipTemporalIou(c, k) > iouThreshold)) {
      removedIds.push(c.id)
      continue
    }
    kept.push(c)
  }
  return { kept, removedIds }
}
