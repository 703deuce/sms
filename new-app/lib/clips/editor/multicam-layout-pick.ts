import type { ClipEditsV2 } from '@/lib/clips/edits'
import { MAIN_ANGLE, multicamAngles, type Angle } from '@/lib/clips/editor/multicam-manual'
import { normalizeSegmentLayout, type SegmentLayoutKind, type SourceSegmentLayout } from '@/lib/clips/editor/segment-layout'
import type { ClipMediaSource } from '@/lib/clips/editor/sources'

/** Registered angle partner ids (main → `'main'`), excluding the segment's source. */
export function layoutPartnersForSegment(edits: ClipEditsV2, lib: readonly ClipMediaSource[], segSourceId: string): string[] {
  const angles: Angle[] = multicamAngles(edits, lib)
  return angles
    .map((a) => (a.sourceId === MAIN_ANGLE ? 'main' : a.sourceId))
    .filter((id) => id !== segSourceId)
}

export function layoutForKind(
  kind: SegmentLayoutKind,
  segSourceId: string,
  edits: ClipEditsV2,
  lib: readonly ClipMediaSource[],
): SourceSegmentLayout | null {
  const partners = layoutPartnersForSegment(edits, lib, segSourceId)
  const withSourceId = segSourceId !== 'main' && segSourceId !== MAIN_ANGLE ? 'main' : (partners[0] ?? 'main')
  const split = 0.5
  const pip = { pipCorner: 'BR' as const, pipScale: 0.3 }
  if (kind === 'grid') {
    if (partners.length < 3) return null
    return {
      kind,
      withSourceId: partners[0]!,
      withSourceId2: partners[1]!,
      withSourceId3: partners[2]!,
    }
  }
  return {
    kind,
    withSourceId,
    ...(kind === 'stack' || kind === 'side_by_side' ? { split } : {}),
    ...(kind === 'pip' ? pip : {}),
  }
}

export function layoutPersistedOnSegment(
  next: ClipEditsV2,
  seg: { startMs: number; endMs: number; sourceId: string },
  requested: SourceSegmentLayout | null,
): boolean {
  const hit = (next.sourceSegments ?? []).find(
    (s) => s.startMs === seg.startMs && s.endMs === seg.endMs && s.sourceId === seg.sourceId,
  )
  if (!requested) return !hit?.layout
  const norm = hit ? normalizeSegmentLayout(hit.layout, next.sources, seg.sourceId) : undefined
  return norm?.kind === requested.kind
}
