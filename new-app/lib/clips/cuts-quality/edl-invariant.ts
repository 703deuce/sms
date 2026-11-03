/**
 * CUTS_QUALITY1 §5: EDL sync checks — captions use wordsAfterEdits (same map as export).
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { orderedKeepSegments, outputDurationMs, remapTime, wordsAfterEdits, type ClipWord } from '@/lib/clips/edits'

const FRAME_MS = 33

export type EdlInvariantResult = {
  ok: boolean
  captionMismatches: number
  durationMismatchMs: number
}

export function verifyEdlCaptionSync(words: ClipWord[], edits: ClipEditsV2): EdlInvariantResult {
  const segs = orderedKeepSegments(edits)
  const { words: mapped } = wordsAfterEdits(words, edits)
  let captionMismatches = 0
  for (const orig of words) {
    const sMs = orig.s * 1000
    const eMs = orig.e * 1000
    const mid = (sMs + eMs) / 2
    if (!segs.some(([a, b]) => a <= mid && mid < b)) continue
    const outMid = remapTime(mid, segs)
    if (outMid == null) {
      captionMismatches++
      continue
    }
    const hit = mapped.find((m) => m.w === orig.w && Math.abs(m.s * 1000 - outMid) < FRAME_MS)
    if (!hit) captionMismatches++
  }
  const keptMs = segs.reduce((n, [a, b]) => n + (b - a), 0)
  const durationMismatchMs = Math.abs(outputDurationMs(edits) - keptMs)
  return {
    ok: captionMismatches === 0 && durationMismatchMs <= FRAME_MS,
    captionMismatches,
    durationMismatchMs,
  }
}

export function mapSourceMsThroughEdits(edits: ClipEditsV2, srcMs: number): number | null {
  return remapTime(srcMs, orderedKeepSegments(edits))
}
