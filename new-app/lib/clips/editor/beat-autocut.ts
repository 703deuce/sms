import type { BrollItem } from '@/lib/clips/broll'

export function beatGrid(beatsMs: number[], every: 1 | 2 | 4, fromMs: number): number[] {
  if (!beatsMs.length) return []
  const sorted = [...beatsMs].sort((a, b) => a - b)
  let startIdx = 0
  let bestDist = Infinity
  for (let i = 0; i < sorted.length; i++) {
    const d = Math.abs(sorted[i]! - fromMs)
    if (d < bestDist) {
      bestDist = d
      startIdx = i
    }
  }
  const out: number[] = []
  for (let i = startIdx; i < sorted.length; i += every) out.push(sorted[i]!)
  return out
}

export type AutoCutOverlayResult = {
  items: { id: string; startMs: number; endMs: number }[]
  skipped: string[]
}

export function autoCutOverlays(
  items: Pick<BrollItem, 'id' | 'startMs' | 'endMs' | 'inMs' | 'still'>[],
  beatsMs: number[],
  every: 1 | 2 | 4,
  mediaLenMs: (id: string, inMs: number) => number | null,
): AutoCutOverlayResult {
  const sorted = [...items].sort((a, b) => a.startMs - b.startMs)
  if (!sorted.length || !beatsMs.length) return { items: sorted.map((i) => ({ id: i.id, startMs: i.startMs, endMs: i.endMs })), skipped: [] }
  const from = sorted[0]!.startMs
  const grid = beatGrid(beatsMs, every, from)
  const out: AutoCutOverlayResult['items'] = []
  const skipped: string[] = []
  for (let k = 0; k < sorted.length; k++) {
    const item = sorted[k]!
    const g0 = grid[k]
    const g1 = grid[k + 1]
    if (g0 == null || g1 == null) {
      out.push({ id: item.id, startMs: item.startMs, endMs: item.endMs })
      skipped.push(item.id)
      continue
    }
    let endMs = g1
    if (!item.still) {
      const inMs = item.inMs ?? 0
      const len = mediaLenMs(item.id, inMs)
      if (len != null && inMs + (endMs - g0) > len) endMs = g0 + Math.max(0, len - inMs)
    }
    out.push({ id: item.id, startMs: g0, endMs: Math.max(g0 + 100, endMs) })
  }
  return { items: out, skipped }
}

export function beatSplitsForSegment(
  segment: { startMs: number; endMs: number; srcIn: number; srcOut: number },
  beatsOutputMs: number[],
  every: 1 | 2 | 4,
  outputToSource: (outMs: number) => number,
  existingSplits: number[] = [],
): number[] {
  const grid = beatGrid(beatsOutputMs, every, segment.startMs)
  const splits = new Set(existingSplits)
  for (const beat of grid) {
    if (beat <= segment.startMs || beat >= segment.endMs) continue
    const src = Math.round(outputToSource(beat))
    if (src <= segment.srcIn + 100 || src >= segment.srcOut - 100) continue
    splits.add(src)
  }
  const merged = [...splits].sort((a, b) => a - b)
  const minGap = 100
  const out: number[] = []
  for (const s of merged) {
    if (out.length && s - out[out.length - 1]! < minGap) continue
    out.push(s)
  }
  return out
}
