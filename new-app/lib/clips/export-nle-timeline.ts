import {
  displayDurationMs,
  displayPositionMs,
  normalizeEdits,
  type ClipBounds,
  type ClipEditsV2,
} from '@/lib/clips/edits'
import { speedAtSource } from '@/lib/clips/editor/speed'
import { timebaseFor, videoLaneSegments } from '@/lib/clips/editor/clip-timeline'
import { msToFcpxSeconds, type FcpxmlSegment } from '@/lib/clips/export-xml'

function speedSplitSourcePoints(a: number, b: number, speeds: ClipEditsV2['segmentSpeeds']): number[] {
  const pts = new Set<number>([a, b])
  for (const s of speeds ?? []) {
    if (s.fromMs > a && s.fromMs < b) pts.add(s.fromMs)
    if (s.toMs > a && s.toMs < b) pts.add(s.toMs)
  }
  return [...pts].sort((x, y) => x - y)
}

/**
 * NLE timeline segments: one clip per video-lane piece (videoSplits + cutRanges), with constant
 * speed sub-ranges mapped to export/display time (same clock as the rendered MP4).
 */
export function clipEditsToNleTimelineSegments(
  edits: ClipEditsV2,
  bounds: ClipBounds,
): { segments: FcpxmlSegment[]; timelineDurationSec: number } {
  const normalized = normalizeEdits(edits, bounds)
  const tb = timebaseFor(normalized)
  const vsegs = videoLaneSegments(tb, normalized.videoSplits)
  const segments: FcpxmlSegment[] = []

  for (const vseg of vsegs) {
    const pts = speedSplitSourcePoints(vseg.a, vseg.b, normalized.segmentSpeeds)
    for (let i = 0; i < pts.length - 1; i++) {
      const sa = pts[i]!
      const sb = pts[i + 1]!
      const srcLen = sb - sa
      if (srcLen < 40) continue
      const editStart = vseg.startMs + (sa - vseg.a)
      const editEnd = vseg.startMs + (sb - vseg.a)
      const displayStart = displayPositionMs(normalized, editStart)
      const displayEnd = displayPositionMs(normalized, editEnd)
      const timelineDurMs = Math.max(0, displayEnd - displayStart)
      if (timelineDurMs < 20) continue
      const speed = speedAtSource(normalized.segmentSpeeds, sa)
      segments.push({
        offsetSec: msToFcpxSeconds(displayStart),
        sourceStartSec: msToFcpxSeconds(sa),
        durationSec: msToFcpxSeconds(timelineDurMs),
        sourceDurationSec: msToFcpxSeconds(srcLen),
        speed,
      })
    }
  }

  const timelineDurationSec = msToFcpxSeconds(displayDurationMs(normalized))
  return { segments, timelineDurationSec }
}
