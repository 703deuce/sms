import type { ClipWord } from '@/lib/clips/edits'

export type SelectedInterval = { startMs: number; endMs: number; beat: string; reason: string }

export type EditorialEvidence = {
  sourceWindowMs: [number, number]
  keptSeconds: number
  removedSeconds: number
  selections: Array<{
    index: number
    beat: string
    reason: string
    sourceMs: [number, number]
    openingWords: string
    closingWords: string
    wordCount: number
  }>
  joins: Array<{
    fromIndex: number
    toIndex: number
    removedMs: number
    before: string
    after: string
    needsListeningReview: true
  }>
}

/**
 * This is actual transcript evidence, not the model's summary of what it
 * believes the selected footage contains. Every excerpt is drawn from source
 * words and retains the absolute source timebase.
 */
export function buildJustChattingEvidence(
  words: ClipWord[],
  sourceWindowMs: [number, number],
  cuts: SelectedInterval[],
): EditorialEvidence {
  const inRange = words
    .filter((w) => Number.isFinite(w.s) && Number.isFinite(w.e) &&
      w.e > w.s && w.e * 1000 > sourceWindowMs[0] && w.s * 1000 < sourceWindowMs[1])
    .sort((a, b) => a.s - b.s)
  const excerpt = (part: typeof inRange, fromEnd = false) =>
    (fromEnd ? part.slice(-28) : part.slice(0, 28))
      .map((w) => w.w).join(' ').slice(0, 450)
  const selections = cuts.map((cut, index) => {
    const spoken = inRange.filter((w) =>
      w.e * 1000 > cut.startMs && w.s * 1000 < cut.endMs)
    return {
      index, beat: cut.beat, reason: cut.reason,
      sourceMs: [cut.startMs, cut.endMs] as [number, number],
      openingWords: excerpt(spoken),
      closingWords: excerpt(spoken, true),
      wordCount: spoken.length,
    }
  })
  const joins = cuts.slice(1).map((cut, i) => {
    const prior = cuts[i]!
    const before = inRange.filter((w) =>
      w.s * 1000 >= Math.max(prior.startMs, prior.endMs - 12000) &&
      w.e * 1000 <= prior.endMs + 30)
    const after = inRange.filter((w) =>
      w.e * 1000 <= Math.min(cut.endMs, cut.startMs + 12000) &&
      w.s * 1000 >= cut.startMs - 30)
    return {
      fromIndex: i, toIndex: i + 1,
      removedMs: Math.max(0, cut.startMs - prior.endMs),
      before: excerpt(before, true),
      after: excerpt(after),
      needsListeningReview: true as const,
    }
  })
  const keptMs = cuts.reduce((total, cut) => total + cut.endMs - cut.startMs, 0)
  return {
    sourceWindowMs,
    keptSeconds: Math.round(keptMs / 1000),
    removedSeconds: Math.max(0, Math.round(((sourceWindowMs[1] - sourceWindowMs[0]) - keptMs) / 1000)),
    selections, joins,
  }
}
