/** Word-safe cut ranges — never split tokens; pad gap cuts. */

import type { CutRange } from '@/lib/clips/edits'

export const WORD_CUT_PAD_MS = 60
export const WORD_CUT_MIN_MS = 40

export type WordSpanMs = { s: number; e: number; w?: string }

function wordSpanMs(w: WordSpanMs): [number, number] {
  return [Math.round(w.s * 1000), Math.round(w.e * 1000)]
}

/** True when cut interior intersects a word's interior (not only touching edges). */
export function cutIntersectsWordInterior([cutStart, cutEnd]: CutRange, words: WordSpanMs[]): boolean {
  const a = Math.min(cutStart, cutEnd)
  const b = Math.max(cutStart, cutEnd)
  if (b - a < WORD_CUT_MIN_MS) return false
  for (const w of words) {
    const [ws, we] = wordSpanMs(w)
    const mid = (ws + we) / 2
    if (mid > a && mid < b) return true
  }
  return false
}

/** Snap gap-style cut to word boundaries with pad; returns null if unsalvageable. */
export function snapCutRangeToWordGaps(
  range: CutRange,
  words: WordSpanMs[],
  padMs = WORD_CUT_PAD_MS,
): CutRange | null {
  const [a, b] = range
  if (b - a < WORD_CUT_MIN_MS) return null
  if (!words.length) return range
  const sorted = [...words].sort((x, y) => x.s - y.s)
  let start = a
  let end = b
  for (const w of sorted) {
    const [ws, we] = wordSpanMs(w)
    if (we <= start || ws >= end) continue
    if (ws > start) start = Math.min(end, ws + padMs)
    if (we < end) end = Math.max(start, we - padMs)
  }
  if (end - start < WORD_CUT_MIN_MS) return null
  if (cutIntersectsWordInterior([start, end], sorted)) return null
  return [Math.round(start), Math.round(end)]
}

export function sanitizeCutRangesForWords(
  cuts: CutRange[],
  words: WordSpanMs[],
  padMs = WORD_CUT_PAD_MS,
): CutRange[] {
  const out: CutRange[] = []
  for (const c of cuts) {
    if (cutIntersectsWordInterior(c, words)) {
      const snapped = snapCutRangeToWordGaps(c, words, padMs)
      if (snapped) out.push(snapped)
      continue
    }
    out.push(c)
  }
  return out
}
