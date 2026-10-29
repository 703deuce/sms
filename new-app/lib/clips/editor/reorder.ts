import type { ClipEditsV2, CutRange } from '@/lib/clips/edits'
import { normalizeSectionOrder, orderedKeepSegments } from '@/lib/clips/edits'

export type WordSpan = { startMs: number; endMs: number }

function snapMs(ms: number, trimIn: number, trimOut: number, gaps: number[]): number {
  const candidates = [trimIn, trimOut, ...gaps]
  let best = ms
  let bestD = Infinity
  for (const g of candidates) {
    const d = Math.abs(g - ms)
    if (d < bestD) {
      bestD = d
      best = g
    }
  }
  return best
}

export function wordGapBoundaries(words: WordSpan[], trimIn: number, trimOut: number): number[] {
  const gaps: number[] = []
  const sorted = [...words].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!
    const b = sorted[i + 1]!
    gaps.push(Math.round((a.endMs + b.startMs) / 2))
  }
  return gaps.filter((g) => g > trimIn && g < trimOut)
}

export function sectionBlocksForEdits(edits: ClipEditsV2): CutRange[] {
  const norm = normalizeSectionOrder(edits.sectionOrder, edits.trim.in, edits.trim.out)
  if (norm?.length) return norm
  const segs = orderedKeepSegments(edits)
  if (segs.length) return segs
  return [[edits.trim.in, edits.trim.out]]
}

function mergeContiguous(blocks: CutRange[]): CutRange[] {
  if (!blocks.length) return blocks
  const out: CutRange[] = [[blocks[0]![0], blocks[0]![1]]]
  for (let i = 1; i < blocks.length; i++) {
    const [s, e] = blocks[i]!
    const prev = out[out.length - 1]!
    if (prev[1] === s) prev[1] = e
    else out.push([s, e])
  }
  return out
}

function blockContaining(blocks: CutRange[], s: number, e: number): number | null {
  const a = Math.min(s, e)
  const b = Math.max(s, e)
  for (let i = 0; i < blocks.length; i++) {
    const [bs, be] = blocks[i]!
    if (a >= bs - 1 && b <= be + 1) return i
  }
  return null
}

function snapRangeToWords(
  s: number,
  e: number,
  wordSpans: WordSpan[],
  trimIn: number,
  trimOut: number,
): [number, number] | null {
  const a = Math.min(s, e)
  const b = Math.max(s, e)
  const hit = wordSpans.filter((w) => w.endMs > a && w.startMs < b)
  if (!hit.length) return null
  const ns = Math.max(trimIn, Math.min(...hit.map((w) => w.startMs)))
  const ne = Math.min(trimOut, Math.max(...hit.map((w) => w.endMs)))
  return ne > ns ? [Math.round(ns), Math.round(ne)] : null
}

/** Move selected source range up/down in output block order; returns new sectionOrder or null. */
export function moveSelection(
  edits: ClipEditsV2,
  range: [number, number],
  dir: 'up' | 'down',
  wordSpans: WordSpan[],
): CutRange[] | null {
  const aligned = snapRangeToWords(range[0], range[1], wordSpans, edits.trim.in, edits.trim.out)
  if (!aligned) return null
  const [s, e] = aligned
  if (e <= s) return null

  const blocks = sectionBlocksForEdits(edits)
  const bi = blockContaining(blocks, s, e)
  if (bi === null) return null

  const [bs, be] = blocks[bi]!
  const pieces: CutRange[] = []
  for (let i = 0; i < blocks.length; i++) {
    if (i !== bi) {
      pieces.push([blocks[i]![0], blocks[i]![1]])
      continue
    }
    if (s > bs) pieces.push([bs, s])
    pieces.push([s, e])
    if (e < be) pieces.push([e, be])
  }

  const selIdx = pieces.findIndex(([a, b]) => s >= a && e <= b)
  if (selIdx < 0) return null
  const swapWith = dir === 'up' ? selIdx - 1 : selIdx + 1
  if (swapWith < 0 || swapWith >= pieces.length) return null

  const swapped = pieces.slice()
  const tmp = swapped[selIdx]!
  swapped[selIdx] = swapped[swapWith]!
  swapped[swapWith] = tmp

  const merged = mergeContiguous(swapped.filter(([a, b]) => b - a >= 300))
  const normalized = normalizeSectionOrder(merged, edits.trim.in, edits.trim.out)
  if (normalized?.length) return normalized
  const sorted = [...merged].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const sameOrder =
    merged.length === sorted.length &&
    merged.every((r, i) => r[0] === sorted[i]![0] && r[1] === sorted[i]![1])
  if (!sameOrder && merged.length > 1) return merged
  return null
}
