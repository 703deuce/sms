import { overlapFraction } from '@/lib/ai-producer-agent/clip-mode/candidates'
import type { SourcePassage } from '@/lib/ai-producer-agent/clip-mode/story-coverage'

/**
 * Unified merge overlap threshold.
 * Overlap fraction = intersection of source time across all segments
 * divided by the duration of the shorter clip (sum of its segment lengths).
 * More than 60% is a duplicate; 60% and under is allowed when the clips
 * are clearly different.
 */
export const UNIFIED_OVERLAP_THRESHOLD = 0.6

export type UnifiedClipType = 'story' | 'continuous'

export type UnifiedMergeClip<T = unknown> = {
  id: string
  type: UnifiedClipType
  score: number
  segments: readonly SourcePassage[]
  startMs: number
  data?: T
}

export type UnifiedOverlap = { clipId: string; fraction: number }
export type DroppedDuplicate = { droppedId: string; keptId: string; fraction: number }

export type UnifiedKeptClip<T = unknown> = UnifiedMergeClip<T> & { overlaps: UnifiedOverlap[] }

export type UnifiedMergeResult<T = unknown> = {
  kept: UnifiedKeptClip<T>[]
  droppedDuplicates: DroppedDuplicate[]
  mix: { story: number; continuous: number; droppedDuplicates: number }
}

function compareClips(a: UnifiedMergeClip, b: UnifiedMergeClip): number {
  if (b.score !== a.score) return b.score - a.score
  if (a.type !== b.type) return a.type === 'story' ? -1 : 1
  return a.startMs - b.startMs
}

function roundFraction(fraction: number): number {
  return Math.round(fraction * 1000) / 1000
}

/** Merge Story and continuous candidates into one scored list. */
export function mergeUnifiedClips<T>(
  clips: readonly UnifiedMergeClip<T>[],
  threshold = UNIFIED_OVERLAP_THRESHOLD,
): UnifiedMergeResult<T> {
  const ranked = [...clips].sort(compareClips)
  const afterDedupe: UnifiedMergeClip<T>[] = []
  const droppedDuplicates: DroppedDuplicate[] = []
  for (const clip of ranked) {
    let duplicateOf: { id: string; fraction: number } | null = null
    for (const kept of afterDedupe) {
      const fraction = overlapFraction(clip.segments, kept.segments)
      if (fraction > threshold) {
        // Ranked score-desc, Story first on a tie, so the already-kept clip wins.
        duplicateOf = { id: kept.id, fraction }
        break
      }
    }
    if (duplicateOf) {
      droppedDuplicates.push({
        droppedId: clip.id,
        keptId: duplicateOf.id,
        fraction: roundFraction(duplicateOf.fraction),
      })
      continue
    }
    afterDedupe.push(clip)
  }

  const stories = afterDedupe.filter((c) => c.type === 'story')
  const continuous = afterDedupe.filter((c) => c.type === 'continuous').sort(compareClips)
  // Story must be the majority whenever at least one Story clip survived.
  // Never drop a Story clip only to change the mix. If no Story survived,
  // ship the valid continuous clips rather than inventing Story results.
  const selectedContinuous =
    stories.length > 0 ? continuous.slice(0, Math.max(0, stories.length - 1)) : continuous

  const keptBase = [...stories, ...selectedContinuous].sort(compareClips)
  const kept: UnifiedKeptClip<T>[] = keptBase.map((clip) => {
    const overlaps: UnifiedOverlap[] = []
    for (const other of keptBase) {
      if (other.id === clip.id) continue
      const fraction = overlapFraction(clip.segments, other.segments)
      if (fraction > 0 && fraction <= threshold) {
        overlaps.push({ clipId: other.id, fraction: roundFraction(fraction) })
      }
    }
    return { ...clip, overlaps }
  })

  return {
    kept,
    droppedDuplicates,
    mix: {
      story: kept.filter((c) => c.type === 'story').length,
      continuous: kept.filter((c) => c.type === 'continuous').length,
      droppedDuplicates: droppedDuplicates.length,
    },
  }
}
