import type { CutRange } from '@/lib/clips/edits'
import { wordSourceMs, type SourceWord } from '@/lib/clips/source-words'
import { symmetricGapTrimMs } from '@/lib/clips/script-edl/word-adjust'
import { snapCutRangeToWordGaps } from '@/lib/clips/word-cut'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import { gapMsBetween, listGapHits, type GapFilterMode, type GapHit } from '@/lib/clips/script-editor/gap-hits'

/** Source-ms cut range that shortens a pause between two word boundaries to targetGapMs. */
export function gapShortenCutRange(
  gapStartMs: number,
  gapEndMs: number,
  gapMs: number,
  targetGapMs: number,
  words?: { s: number; e: number }[],
): CutRange | null {
  const remove = symmetricGapTrimMs(gapMs, targetGapMs)
  if (remove <= 50) return null
  const mid = gapStartMs + gapMs / 2
  let lo = Math.round(mid - remove / 2)
  let hi = Math.round(mid + remove / 2)
  lo = Math.max(gapStartMs, lo)
  hi = Math.min(gapEndMs, hi)
  if (hi - lo < 40) return null
  const raw: CutRange = [lo, hi]
  if (words?.length) {
    const snapped = snapCutRangeToWordGaps(raw, words, 60) ?? raw
    return [
      Math.max(gapStartMs, snapped[0]),
      Math.min(gapEndMs, snapped[1]),
    ] as CutRange
  }
  return raw
}

export function gapCutBetweenSourceWords(
  prev: SourceWord,
  word: SourceWord,
  cutRanges: CutRange[],
): CutRange | null {
  const gapStart = wordSourceMs(prev).endMs
  const gapEnd = wordSourceMs(word).startMs
  if (gapEnd <= gapStart + 20) return null
  for (const [s, e] of cutRanges) {
    if (e <= gapStart || s >= gapEnd) continue
    const lo = Math.max(s, gapStart)
    const hi = Math.min(e, gapEnd)
    if (hi - lo >= 40) return [lo, hi]
  }
  return null
}

export function gapCutBetweenWords(
  prev: EditorWord,
  word: EditorWord,
  cutRanges: CutRange[],
): CutRange | null {
  const gapStart = prev.t1Ms
  const gapEnd = word.t0Ms
  if (gapEnd <= gapStart + 20) return null
  for (const [s, e] of cutRanges) {
    if (e <= gapStart || s >= gapEnd) continue
    const lo = Math.max(s, gapStart)
    const hi = Math.min(e, gapEnd)
    if (hi - lo >= 40) return [lo, hi]
  }
  return null
}

export function gapHitAlreadyCut(hit: GapHit, cutRanges: CutRange[], targetGapMs: number): boolean {
  const existing = gapCutBetweenWords(hit.prevWord, hit.word, cutRanges)
  if (!existing) return false
  const remaining = gapMsBetween(hit.prevWord, hit.word) - (existing[1] - existing[0])
  return remaining <= targetGapMs + 80
}

export function listClipGapHits(
  orderedWords: EditorWord[],
  cutRanges: CutRange[],
  opts: {
    mode: GapFilterMode
    minGapMs: number
    maxGapMs?: number
    targetGapMs: number
    maxPlausibleGapMs?: number
  },
): GapHit[] {
  const deleted = new Set<string>()
  for (const w of orderedWords) {
    if (cutRanges.some(([a, b]) => w.t0Ms < b && w.t1Ms > a)) deleted.add(w.id)
  }
  const hits = listGapHits(orderedWords, deleted, {
    mode: opts.mode,
    minGapMs: opts.minGapMs,
    maxGapMs: opts.maxGapMs,
  })
  const plausible = opts.maxPlausibleGapMs ?? 15_000
  return hits.filter(
    (h) => h.gapMs <= plausible && !gapHitAlreadyCut(h, cutRanges, opts.targetGapMs),
  )
}
