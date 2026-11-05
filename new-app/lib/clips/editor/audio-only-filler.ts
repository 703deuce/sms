import type { CutRange, ClipEditsV2 } from '@/lib/clips/edits'
import { mergeCutRanges, sanitizeCutRangesForTrim } from '@/lib/clips/edits'

/**
 * Audio-only cleanup operates in original source milliseconds.
 * It never changes cutRanges or the video EDL. Use 12 ms edge ramps
 * to avoid clicks while preserving frame count and B-roll alignment.
 */
export const AUDIO_MUTE_RAMP_MS = 12

export function addAudioMuteRanges(edits: ClipEditsV2, ranges: CutRange[]): ClipEditsV2 {
  const incoming = sanitizeCutRangesForTrim(ranges, edits.trim.in, edits.trim.out)
  return {
    ...edits,
    audioMuteRanges: mergeCutRanges([...(edits.audioMuteRanges ?? []), ...incoming]),
  }
}

export function removeAudioMuteRanges(edits: ClipEditsV2, ranges: CutRange[]): ClipEditsV2 {
  const remaining = (edits.audioMuteRanges ?? []).filter(
    ([a,b]) => !ranges.some(([s,e]) => s < b && a < e),
  )
  return { ...edits, audioMuteRanges: remaining }
}

/** Smooth gain in source time; never mute audio outside the chosen range. */
export function audioMuteGain(sourceMs: number, ranges: readonly CutRange[] | undefined): number {
  if (!ranges?.length) return 1
  for (const [start, end] of ranges) {
    if (sourceMs < start || sourceMs >= end) continue
    const fade = Math.min(AUDIO_MUTE_RAMP_MS, (end - start) / 2)
    if (fade <= 0) continue
    if (sourceMs < start + fade) return Math.max(0, 1 - (sourceMs - start) / fade)
    if (sourceMs >= end - fade) return Math.min(1, (sourceMs - (end - fade)) / fade)
    return 0
  }
  return 1
}

export function audioMuteAllowed(edits: ClipEditsV2): boolean {
  // An audio-only source edit is not yet supported against time-warped or
  // replaced voice media. In those cases the UI must use ripple mode.
  return !edits.sourceSegments?.length && !edits.segmentSpeeds?.length &&
    !edits.speedCurves?.length && !edits.splitEdits?.length &&
    (!edits.speed || edits.speed === 1)
}
