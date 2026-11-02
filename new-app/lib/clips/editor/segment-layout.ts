import { MAIN_ANGLE } from '@/lib/clips/editor/multicam-manual'
import type { ClipMediaSource } from '@/lib/clips/editor/sources'
import { MAIN_SOURCE_ID, sourceById } from '@/lib/clips/editor/sources'

export type SegmentLayoutKind = 'side_by_side' | 'stack' | 'pip' | 'grid'

export type PipCorner = 'TL' | 'TR' | 'BL' | 'BR'

export type SourceSegmentLayout = {
  kind: SegmentLayoutKind
  /** Other angle id or `main` (main camera). */
  withSourceId: string
  withSourceId2?: string
  withSourceId3?: string
  pipCorner?: PipCorner
  pipScale?: number
  /** Primary share for stack / side_by_side split (0.3–0.7). */
  split?: number
}

const PIP_CORNERS = new Set<PipCorner>(['TL', 'TR', 'BL', 'BR'])
const KINDS = new Set<SegmentLayoutKind>(['side_by_side', 'stack', 'pip', 'grid'])

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

function resolveWithId(raw: unknown, sources: readonly ClipMediaSource[] | undefined, ownSourceId: string): string | null {
  if (raw === MAIN_ANGLE || raw === MAIN_SOURCE_ID || raw === 'main') return 'main'
  const id = String(raw ?? '').trim()
  if (!id || id === ownSourceId) return null
  if (id === 'main') return 'main'
  return sourceById(sources, id) ? id : null
}

/** Drop invalid layouts; mirrors worker normalize_segment_layout. */
export function normalizeSegmentLayout(
  raw: unknown,
  sources: readonly ClipMediaSource[] | undefined,
  ownSourceId: string,
): SourceSegmentLayout | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const kind = o.kind as SegmentLayoutKind
  if (!KINDS.has(kind)) return undefined
  const withSourceId = resolveWithId(o.withSourceId, sources, ownSourceId)
  if (!withSourceId) return undefined
  const splitRaw = Number(o.split)
  const split = Number.isFinite(splitRaw) ? clamp(splitRaw, 0.3, 0.7) : 0.5
  const pipScaleRaw = Number(o.pipScale)
  const pipScale = Number.isFinite(pipScaleRaw) ? clamp(pipScaleRaw, 0.2, 0.45) : 0.3
  const pipCorner = PIP_CORNERS.has(o.pipCorner as PipCorner) ? (o.pipCorner as PipCorner) : 'BR'
  const withSourceId2 = o.withSourceId2 != null ? resolveWithId(o.withSourceId2, sources, ownSourceId) : undefined
  const withSourceId3 = o.withSourceId3 != null ? resolveWithId(o.withSourceId3, sources, ownSourceId) : undefined
  if (kind === 'grid') {
    if (!withSourceId2) return undefined
  }
  return {
    kind,
    withSourceId,
    ...(withSourceId2 ? { withSourceId2 } : {}),
    ...(withSourceId3 ? { withSourceId3 } : {}),
    ...(kind === 'pip' ? { pipCorner, pipScale } : {}),
    ...(kind === 'stack' || kind === 'side_by_side' ? { split } : {}),
  }
}

export const LAYOUT_KIND_LABEL: Record<SegmentLayoutKind, string> = {
  side_by_side: 'Side by side',
  stack: 'Stacked',
  pip: 'Picture in picture',
  grid: '2×2 grid',
}
