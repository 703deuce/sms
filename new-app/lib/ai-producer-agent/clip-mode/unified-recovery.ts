import { mergeUnifiedClips, type UnifiedMergeResult } from '@/lib/ai-producer-agent/clip-mode/unified-merge'
import type { SourcePassage } from '@/lib/ai-producer-agent/clip-mode/story-coverage'

export type SavedUnifiedClip = {
  id: string
  score: number
  startMs: number
  endMs: number
  editsSaveVersion: number
  updatedAt: Date
  aiMeta: unknown
}

export type RecoveryRankedClip = {
  id: string
  type: 'story' | 'continuous'
  score: number
  segments: SourcePassage[]
  startMs: number
  meta: Record<string, unknown>
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
}

function recoveredSegments(meta: Record<string, unknown>, startMs: number, endMs: number): SourcePassage[] {
  const segments = Array.isArray(meta.stitchSegments)
    ? meta.stitchSegments.flatMap((row): SourcePassage[] => {
      const entry = asRecord(row)
      const start = Number(entry.startMs)
      const end = Number(entry.endMs)
      return Number.isFinite(start) && Number.isFinite(end) && end > start
        ? [{ startMs: start, endMs: end }] : []
    })
    : []
  return segments.length ? segments : [{ startMs, endMs }]
}

/** Deterministic salvage: reuse the same Story/Continuous merge as the normal runner.
 * A persisted editable draft with no QA score can still be offered for review,
 * but it is never falsely presented as a fully reviewed/auto-exported clip. */
export function rankSavedUnifiedClips(
  clips: readonly SavedUnifiedClip[],
): UnifiedMergeResult<RecoveryRankedClip> {
  return mergeUnifiedClips(clips.flatMap((clip) => {
    if (clip.endMs <= clip.startMs || !(clip.editsSaveVersion > 0 || clip.score > 0)) return []
    const meta = asRecord(clip.aiMeta)
    const mode = meta.clipMode ?? meta.mode
    const type: 'story' | 'continuous' =
      meta.type === 'continuous' || mode === 'clip_moment_v1' ? 'continuous' : 'story'
    const sourceScore = Number(meta.finderScore)
    const score = Math.max(0, Math.min(100, Math.round(
      clip.score > 0 ? clip.score : Number.isFinite(sourceScore) ? sourceScore : 0,
    )))
    const data: RecoveryRankedClip = {
      id: clip.id, type, score,
      segments: recoveredSegments(meta, clip.startMs, clip.endMs),
      startMs: clip.startMs,
      meta,
    }
    return [{ id: clip.id, type, score, segments: data.segments, startMs: clip.startMs, data }]
  }))
}
