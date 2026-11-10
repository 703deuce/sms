import type { YoutubeVideoCut } from '@/lib/youtube-video/types'

/** Overlap fraction = intersection / duration of the shorter cut. */
export function cutOverlapFraction(a: YoutubeVideoCut, b: YoutubeVideoCut): number {
  if (a.sourceId !== b.sourceId) return 0
  const start = Math.max(a.startMs, b.startMs)
  const end = Math.min(a.endMs, b.endMs)
  const intersection = Math.max(0, end - start)
  const shorter = Math.min(Math.max(0, a.endMs - a.startMs), Math.max(0, b.endMs - b.startMs))
  if (shorter <= 0) return 0
  return intersection / shorter
}

/** Chronological sort, then merge cuts that share more than 60% of the shorter cut. No length cap. */
export function sortAndMergeCuts(cuts: YoutubeVideoCut[], overlapThreshold = 0.6): YoutubeVideoCut[] {
  const valid = cuts.filter((cut) => Number.isFinite(cut.startMs) && Number.isFinite(cut.endMs) && cut.endMs > cut.startMs)
  const sorted = [...valid].sort((a, b) => {
    if (a.sourceId !== b.sourceId) return a.sourceId.localeCompare(b.sourceId)
    return a.startMs - b.startMs || a.endMs - b.endMs
  })
  const kept: YoutubeVideoCut[] = []
  for (const cut of sorted) {
    const dupIndex = kept.findIndex((existing) => cutOverlapFraction(existing, cut) > overlapThreshold)
    if (dupIndex < 0) {
      kept.push(cut)
      continue
    }
    const existing = kept[dupIndex]!
    const existingDur = existing.endMs - existing.startMs
    const nextDur = cut.endMs - cut.startMs
    if (nextDur > existingDur) kept[dupIndex] = cut
  }
  return kept.sort((a, b) => a.startMs - b.startMs)
}

export function assembledDurationMs(cuts: YoutubeVideoCut[]): number {
  return cuts.reduce((sum, cut) => sum + Math.max(0, cut.endMs - cut.startMs), 0)
}
