import type { ClipEditsV2, CutRange } from '@/lib/clips/edits'
import { mergeCutRanges, subtractRangeFromCuts } from '@/lib/clips/edits'
import { gapShortenCutRange, listClipGapHits } from '@/lib/clips/gap-shorten'
import type { GapFilterMode } from '@/lib/clips/script-editor/gap-hits'
import { listFillerHits, type FillerFilter } from '@/lib/clips/script-editor/filler-hits'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import { sanitizeCutRangesForWords, snapCutRangeToWordGaps } from '@/lib/clips/word-cut'
import type { RetakeGroup } from '@/lib/clips/editor/retakes'
import { retakeCutRange } from '@/lib/clips/editor/retakes'

export type CleanupCutKind = 'filler' | 'gap' | 'manual' | 'unknown' | 'retake'

export type CleanupProposal = {
  id: string
  kind: CleanupCutKind
  range: CutRange
  label: string
}

export function proposalId(range: CutRange): string {
  return `${range[0]}:${range[1]}`
}

function rangeCoversWord(range: CutRange, word: EditorWord, slackMs = 25): boolean {
  const [a, b] = range
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  return word.t0Ms >= lo - slackMs && word.t1Ms <= hi + slackMs
}

function rangeInGap(range: CutRange, prev: EditorWord, next: EditorWord, slackMs = 40): boolean {
  const [a, b] = range
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  const gapStart = prev.t1Ms
  const gapEnd = next.t0Ms
  if (gapEnd - gapStart < 50) return false
  return lo >= gapStart - slackMs && hi <= gapEnd + slackMs
}

export function classifyCut(
  range: CutRange,
  orderedWords: EditorWord[],
  deletedSet: Set<string>,
): CleanupCutKind {
  for (let i = 0; i < orderedWords.length; i++) {
    const w = orderedWords[i]
    if (deletedSet.has(w.id)) continue
    if (w.isFiller && rangeCoversWord(range, w)) return 'filler'
  }
  for (let i = 1; i < orderedWords.length; i++) {
    const prev = orderedWords[i - 1]
    const w = orderedWords[i]
    if (deletedSet.has(prev.id) || deletedSet.has(w.id)) continue
    if (rangeInGap(range, prev, w)) return 'gap'
  }
  return 'unknown'
}

export function fillerProposals(
  orderedWords: EditorWord[],
  deletedSet: Set<string>,
  opts?: { filter?: FillerFilter; avoidHarshCuts?: boolean },
): CleanupProposal[] {
  const hits = listFillerHits(orderedWords, deletedSet, opts)
  return hits.map((h) => ({
    id: proposalId([h.word.t0Ms, h.word.t1Ms]),
    kind: 'filler' as const,
    range: [h.word.t0Ms, h.word.t1Ms] as CutRange,
    label: h.word.text.trim() || 'filler',
  }))
}

export function retakeProposals(
  groups: RetakeGroup[],
  existingCuts: CutRange[] = [],
): CleanupProposal[] {
  const out: CleanupProposal[] = []
  for (const group of groups) {
    const range = retakeCutRange(group, existingCuts)
    if (!range) continue
    const first = group.attempts[0]?.text ?? ''
    const preview = first.split(/\s+/).slice(0, 6).join(' ')
    const label = `Retake · "${preview}${first.split(/\s+/).length > 6 ? '…' : ''}"`
    out.push({
      id: proposalId(range),
      kind: 'retake',
      range,
      label,
    })
  }
  return out
}

export function gapProposals(
  orderedWords: EditorWord[],
  cutRanges: CutRange[],
  opts: {
    mode: GapFilterMode
    minGapMs: number
    maxGapMs?: number
    targetGapMs: number
    maxPlausibleGapMs?: number
    wordSpans?: { s: number; e: number }[]
  },
): CleanupProposal[] {
  const hits = listClipGapHits(orderedWords, cutRanges, opts)
  return hits.map((hit) => {
    const range =
      gapShortenCutRange(hit.prevWord.t1Ms, hit.word.t0Ms, hit.gapMs, opts.targetGapMs, opts.wordSpans) ??
      ([hit.prevWord.t1Ms, hit.word.t0Ms] as CutRange)
    return {
      id: proposalId(range),
      kind: 'gap' as const,
      range,
      label: `${(hit.gapMs / 1000).toFixed(1)}s pause`,
    }
  })
}

export function appliedCutProposals(
  edits: ClipEditsV2,
  orderedWords: EditorWord[],
  deletedSet: Set<string>,
): CleanupProposal[] {
  const out: CleanupProposal[] = []
  for (const range of edits.cutRanges) {
    const kind = classifyCut(range, orderedWords, deletedSet)
    out.push({
      id: proposalId(range),
      kind: kind === 'unknown' ? 'manual' : kind,
      range,
      label: kind === 'gap' ? 'Shortened pause' : kind === 'filler' ? 'Filler removed' : 'Cut',
    })
  }
  return out
}

export function mergeCleanupCutRanges(
  baseCuts: CutRange[],
  ranges: CutRange[],
  wordSpans: { s: number; e: number; w?: string }[],
): CutRange[] {
  let cuts = [...baseCuts]
  for (const range of ranges) {
    const snapped = wordSpans.length ? snapCutRangeToWordGaps(range, wordSpans) ?? range : range
    const nextRange = wordSpans.length
      ? sanitizeCutRangesForWords([snapped], wordSpans)[0] ?? snapped
      : snapped
    cuts = mergeCutRanges([...cuts, nextRange])
  }
  return cuts
}

export function applyProposalsToEdits(
  edits: ClipEditsV2,
  proposals: CleanupProposal[],
  wordSpans: { s: number; e: number; w?: string }[],
): ClipEditsV2 {
  const ranges = proposals.map((p) => p.range)
  return { ...edits, cutRanges: mergeCleanupCutRanges(edits.cutRanges, ranges, wordSpans) }
}

export function auditionEditsForProposals(
  edits: ClipEditsV2,
  proposals: CleanupProposal[],
  wordSpans: { s: number; e: number; w?: string }[],
): ClipEditsV2 {
  return applyProposalsToEdits(edits, proposals, wordSpans)
}

export function restoreCleanupProposal(edits: ClipEditsV2, range: CutRange): ClipEditsV2 {
  return { ...edits, cutRanges: subtractRangeFromCuts(edits.cutRanges, range) }
}
