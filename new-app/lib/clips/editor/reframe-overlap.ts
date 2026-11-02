/**
 * Q6.2 AI-02 (v1 crop path): split-screen fallback when two speakers overlap in time.
 * Uses existing layout.shotOverrides focus `both` — no REFRAME_V2.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { CropShot } from '@/lib/server/clips/clip-detail'

export function overlappingSpeakerShotIndices(shots: readonly CropShot[]): number[] {
  const out = new Set<number>()
  for (let i = 0; i < shots.length; i++) {
    for (let j = i + 1; j < shots.length; j++) {
      const a = shots[i]!
      const b = shots[j]!
      if (a.speaker === b.speaker) continue
      if (a.startMs < b.endMs && b.startMs < a.endMs) {
        out.add(i)
        out.add(j)
      }
    }
  }
  return [...out].sort((a, b) => a - b)
}

export function applySplitScreenOnOverlap(
  edits: ClipEditsV2,
  shots: readonly CropShot[],
  enabled: boolean,
): ClipEditsV2 {
  if (!enabled) {
    return {
      ...edits,
      layout: { ...edits.layout, splitScreenFallback: false },
    }
  }
  const idxs = overlappingSpeakerShotIndices(shots)
  const prev = edits.layout.shotOverrides ?? []
  const byI = new Map(prev.map((o) => [o.i, o]))
  for (const i of idxs) byI.set(i, { i, focus: 'both' })
  return {
    ...edits,
    layout: {
      ...edits.layout,
      splitScreenFallback: true,
      shotOverrides: [...byI.values()],
    },
  }
}
