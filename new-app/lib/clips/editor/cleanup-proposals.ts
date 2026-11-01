import type { ClipEditsV2, CutRange } from '@/lib/clips/edits'
import { mergeCutRanges, subtractRangeFromCuts } from '@/lib/clips/edits'
import { gapShortenCutRange, listClipGapHits } from '@/lib/clips/gap-shorten'
import type { GapFilterMode } from '@/lib/clips/script-editor/gap-hits'
import { listFillerHits, type FillerFilter } from '@/lib/clips/script-editor/filler-hits'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import { sanitizeCutRangesForWords, snapCutRangeToWordGaps } from '@/lib/clips/word-cut'
import { normalizeCleanupCutRange, sanitizeCleanupCutRanges } from '@/lib/clips/editor/cleanup-cut-boundaries'
import {
  DEFAULT_CLEANUP_STRENGTH,
  fillerEligibleAtStrength,
  gapHasSpeechEnergy,
  gapPresetForStrength,
  isProtectedFromCleanup,
  type CleanupStrength,
} from '@/lib/clips/editor/cleanup-strength'
import type { RetakeGroup } from '@/lib/clips/editor/retakes'
import { retakeCutRange } from '@/lib/clips/editor/retakes'

export type CleanupCutKind = 'filler' | 'gap' | 'manual' | 'unknown' | 'retake' | 'clarity'

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
  opts?: {
    filter?: FillerFilter
    avoidHarshCuts?: boolean
    strength?: CleanupStrength
    enabledOptInFillers?: ReadonlySet<string>
  },
): CleanupProposal[] {
  const strength = opts?.strength ?? DEFAULT_CLEANUP_STRENGTH
  const enabledOptIn = opts?.enabledOptInFillers ?? new Set<string>()
  const hits = listFillerHits(orderedWords, deletedSet, opts)
  const out: CleanupProposal[] = []
  for (const h of hits) {
    if (isProtectedFromCleanup(h.word)) continue
    if (!fillerEligibleAtStrength(h.word.text, h.word.fillerKind, strength, enabledOptIn)) continue
    const raw: CutRange = [h.word.t0Ms, h.word.t1Ms]
    out.push({
      id: proposalId(raw),
      kind: 'filler' as const,
      range: raw,
      label: h.word.text.trim() || 'filler',
    })
  }
  return out
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

export function clarityProposals(
  items: { range: CutRange; reason: string }[],
): CleanupProposal[] {
  return items.map(({ range, reason }) => ({
    id: proposalId(range),
    kind: 'clarity' as const,
    range,
    label: `Clarity · ${reason}`,
  }))
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
    strength?: CleanupStrength
    rmsSamples?: { tMs: number; rms: number }[] | null
  },
): CleanupProposal[] {
  const preset = opts.strength ? gapPresetForStrength(opts.strength) : null
  const minGapMs = preset?.minGapMs ?? opts.minGapMs
  const targetGapMs = preset?.targetGapMs ?? opts.targetGapMs
  const hits = listClipGapHits(orderedWords, cutRanges, { ...opts, minGapMs, targetGapMs })
  return hits
    .filter((hit) => {
      if (!opts.rmsSamples?.length) return true
      return !gapHasSpeechEnergy(hit.prevWord.t1Ms, hit.word.t0Ms, opts.rmsSamples)
    })
    .map((hit) => {
    const range =
      gapShortenCutRange(hit.prevWord.t1Ms, hit.word.t0Ms, hit.gapMs, targetGapMs, opts.wordSpans) ??
      ([hit.prevWord.t1Ms, hit.word.t0Ms] as CutRange)
    const normalized =
      opts.wordSpans?.length != null && opts.wordSpans.length > 0
        ? normalizeCleanupCutRange(range, opts.wordSpans) ?? range
        : range
    return {
      id: proposalId(normalized),
      kind: 'gap' as const,
      range: normalized,
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
    const snapped =
      wordSpans.length > 0
        ? normalizeCleanupCutRange(range, wordSpans) ?? snapCutRangeToWordGaps(range, wordSpans) ?? range
        : range
    const nextRange =
      wordSpans.length > 0
        ? sanitizeCleanupCutRanges([snapped], wordSpans)[0] ??
          sanitizeCutRangesForWords([snapped], wordSpans)[0] ??
          snapped
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
