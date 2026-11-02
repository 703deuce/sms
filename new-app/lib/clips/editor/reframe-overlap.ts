/**
 * Q6.2 AI-02 (v1 crop path): split-screen fallback when two speakers overlap in transcript time.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { CropShot } from '@/lib/server/clips/clip-detail'
import type { LayoutSegment } from '@/lib/clips/layout-segments'
import type { SourceWord } from '@/lib/clips/source-words'

const ALT_MS = 1500

export type OverlapRange = { startMs: number; endMs: number }

/** Word-timeline overlap: different speakers on overlapping words, or rapid A/B alternation. */
export function overlappingSpeakerRangesFromWords(
  words: readonly SourceWord[],
  rangeStartMs: number,
  rangeEndMs: number,
): OverlapRange[] {
  const inRange = words
    .filter((w) => w.e * 1000 > rangeStartMs && w.s * 1000 < rangeEndMs)
    .sort((a, b) => a.s - b.s)
  const ranges: OverlapRange[] = []
  const push = (a: number, b: number) => {
    const startMs = Math.max(rangeStartMs, Math.min(a, b))
    const endMs = Math.min(rangeEndMs, Math.max(a, b))
    if (endMs - startMs >= 200) ranges.push({ startMs, endMs })
  }
  for (let i = 0; i < inRange.length; i++) {
    const wi = inRange[i]!
    const si = wi.spk ?? 0
    const ai = Math.round(wi.s * 1000)
    const bi = Math.round(wi.e * 1000)
    for (let j = i + 1; j < inRange.length; j++) {
      const wj = inRange[j]!
      const aj = Math.round(wj.s * 1000)
      if (aj >= bi) break
      const sj = wj.spk ?? 0
      if (si !== sj) push(ai, Math.max(bi, Math.round(wj.e * 1000)))
    }
    const next = inRange[i + 1]
    if (next && (next.spk ?? 0) !== si) {
      const gap = Math.round(next.s * 1000) - bi
      if (gap >= 0 && gap < ALT_MS) {
        push(ai, Math.round(next.e * 1000))
      }
    }
  }
  ranges.sort((x, y) => x.startMs - y.startMs)
  const merged: OverlapRange[] = []
  for (const r of ranges) {
    const prev = merged[merged.length - 1]
    if (prev && r.startMs <= prev.endMs + 80) {
      prev.endMs = Math.max(prev.endMs, r.endMs)
    } else merged.push({ ...r })
  }
  return merged
}

export function shotIndicesForRange(shots: readonly CropShot[], startMs: number, endMs: number): number[] {
  const out: number[] = []
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i]!
    if (s.startMs < endMs && startMs < s.endMs) out.push(i)
  }
  return out
}

function mergeLayoutSegments(segs: LayoutSegment[], trimIn: number, trimOut: number, fallback: ClipEditsV2['layout']['mode']): LayoutSegment[] {
  const sorted = [...segs].sort((a, b) => a.startMs - b.startMs)
  const out: LayoutSegment[] = []
  for (const s of sorted) {
    const row = { ...s, startMs: Math.max(trimIn, s.startMs), endMs: Math.min(trimOut, s.endMs) }
    if (row.endMs <= row.startMs) continue
    const prev = out[out.length - 1]
    if (prev && prev.mode === row.mode && prev.endMs >= row.startMs - 1) {
      prev.endMs = Math.max(prev.endMs, row.endMs)
    } else out.push(row)
  }
  return out.length ? out : [{ startMs: trimIn, endMs: trimOut, mode: fallback }]
}

export function applySplitScreenOnOverlap(
  edits: ClipEditsV2,
  shots: readonly CropShot[],
  words: readonly SourceWord[],
  enabled: boolean,
): ClipEditsV2 {
  const trimIn = edits.trim.in
  const trimOut = edits.trim.out
  const fallbackMode = edits.layout.mode

  if (!enabled) {
    const shotOverrides = (edits.layout.shotOverrides ?? []).filter((o) => !(o as { auto?: boolean }).auto)
    const layoutSegments = (edits.layout.layoutSegments ?? []).filter(
      (s) => !(s as LayoutSegment & { auto?: boolean }).auto,
    )
    return {
      ...edits,
      layout: {
        ...edits.layout,
        splitScreenFallback: false,
        shotOverrides,
        layoutSegments: layoutSegments.length ? layoutSegments : undefined,
      },
    }
  }

  const ranges = overlappingSpeakerRangesFromWords(words, trimIn, trimOut)
  const shotIdx = new Set<number>()
  for (const r of ranges) {
    for (const i of shotIndicesForRange(shots, r.startMs, r.endMs)) shotIdx.add(i)
  }

  const prevOverrides = edits.layout.shotOverrides ?? []
  const manual = prevOverrides.filter((o) => !(o as { auto?: boolean }).auto)
  const autoOverrides = [...shotIdx].map((i) => ({ i, focus: 'both' as const, auto: true as const }))

  const baseSegs = (edits.layout.layoutSegments ?? [{ startMs: trimIn, endMs: trimOut, mode: fallbackMode }]).filter(
    (s) => !(s as LayoutSegment & { auto?: boolean }).auto,
  )
  const splitSegs: LayoutSegment[] = ranges.map((r) => ({
    startMs: r.startMs,
    endMs: r.endMs,
    mode: 'split',
    auto: true,
  }))

  return {
    ...edits,
    layout: {
      ...edits.layout,
      splitScreenFallback: true,
      shotOverrides: [...manual, ...autoOverrides],
      layoutSegments: mergeLayoutSegments([...baseSegs, ...splitSegs], trimIn, trimOut, fallbackMode),
    },
  }
}

/** @deprecated CropShots are sequential — use overlappingSpeakerRangesFromWords. */
export function overlappingSpeakerShotIndices(_shots: readonly CropShot[]): number[] {
  return []
}
