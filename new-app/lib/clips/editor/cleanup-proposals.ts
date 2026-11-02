import type { ClipEditsV2, CutRange } from '@/lib/clips/edits'
import { mergeCutRanges, subtractRangeFromCuts } from '@/lib/clips/edits'
import { listClipGapHits } from '@/lib/clips/gap-shorten'
import { gapHitIsRmsQuiet, gapShortenCutRangeWithAudio, type GapRmsSample } from '@/lib/clips/gap-audio-trim'
import type { GapFilterMode } from '@/lib/clips/script-editor/gap-hits'
import { listFillerHits, type FillerFilter } from '@/lib/clips/script-editor/filler-hits'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import { sanitizeCutRangesForWords, snapCutRangeToWordGaps } from '@/lib/clips/word-cut'
import { normalizeCleanupCutRange, sanitizeCleanupCutRanges } from '@/lib/clips/editor/cleanup-cut-boundaries'
import {
  DEFAULT_CLEANUP_STRENGTH,
  fillerEligibleAtStrength,
  gapPresetForStrength,
  isProtectedFromCleanup,
  type CleanupStrength,
} from '@/lib/clips/editor/cleanup-strength'
import { optInPhraseAt } from '@/lib/clips/editor/filler-opt-in'
import { excerptForCutRange } from '@/lib/clips/editor/cleanup-text'
import { normalizeToken } from '@/lib/clips/script-editor/enrich-transcript'
import type { RetakeGroup } from '@/lib/clips/editor/retakes'
import { retakeCutRange } from '@/lib/clips/editor/retakes'

export type CleanupCutKind = 'filler' | 'repeat' | 'gap' | 'manual' | 'unknown' | 'retake' | 'clarity'

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
    if (w.isFiller && w.fillerKind === 'repeat' && rangeCoversWord(range, w)) return 'repeat'
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
  const usedIndices = new Set<number>()
  const out: CleanupProposal[] = []

  for (let i = 0; i < orderedWords.length; i++) {
    if (usedIndices.has(i) || deletedSet.has(orderedWords[i]!.id)) continue
    const phraseHit = optInPhraseAt(orderedWords, i, deletedSet, enabledOptIn)
    if (phraseHit) {
      const first = orderedWords[i]!
      const last = orderedWords[phraseHit.endIndex]!
      if (isProtectedFromCleanup(first) || isProtectedFromCleanup(last)) continue
      const raw: CutRange = [first.t0Ms, last.t1Ms]
      for (let k = i; k <= phraseHit.endIndex; k++) usedIndices.add(k)
      out.push({
        id: proposalId(raw),
        kind: 'filler',
        range: raw,
        label: phraseHit.phrase,
      })
      continue
    }
  }

  for (let i = 0; i < orderedWords.length; i++) {
    if (usedIndices.has(i)) continue
    const w = orderedWords[i]!
    if (deletedSet.has(w.id)) continue
    const h = hits.find((x) => x.index === i)
    if (!h) continue
    if (isProtectedFromCleanup(h.word)) continue
    if (!fillerEligibleAtStrength(h.word.text, h.word.fillerKind, strength, enabledOptIn)) continue

    if (h.word.fillerKind === 'repeat') {
      let j = i
      const token = normalizeToken(h.word.text)
      while (j + 1 < orderedWords.length) {
        const n = orderedWords[j + 1]!
        if (deletedSet.has(n.id) || usedIndices.has(j + 1)) break
        if (!n.isFiller || n.fillerKind !== 'repeat') break
        if (normalizeToken(n.text) !== token) break
        j += 1
      }
      for (let k = i; k <= j; k++) usedIndices.add(k)
      const raw: CutRange = [orderedWords[i]!.t0Ms, orderedWords[j]!.t1Ms]
      const snippet = orderedWords
        .slice(i, j + 1)
        .map((x) => x.text.trim())
        .join(' ')
      out.push({
        id: proposalId(raw),
        kind: 'repeat',
        range: raw,
        label: `repeat · "${snippet}"`,
      })
      continue
    }

    const raw: CutRange = [h.word.t0Ms, h.word.t1Ms]
    usedIndices.add(i)
    out.push({
      id: proposalId(raw),
      kind: 'filler',
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
  orderedWords?: EditorWord[],
): CleanupProposal[] {
  return items.map(({ range, reason }) => {
    const excerpt =
      orderedWords && orderedWords.length > 0
        ? excerptForCutRange(orderedWords, range)
        : null
    const detail = excerpt ? `${reason} — "${excerpt}"` : reason
    return {
      id: proposalId(range),
      kind: 'clarity' as const,
      range,
      label: `Clarity · ${detail}`,
    }
  })
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
    rmsSamples?: GapRmsSample[] | null
  },
): CleanupProposal[] {
  const preset = opts.strength ? gapPresetForStrength(opts.strength) : null
  const minGapMs = preset?.minGapMs ?? opts.minGapMs
  const targetGapMs = preset?.targetGapMs ?? opts.targetGapMs
  const hits = listClipGapHits(orderedWords, cutRanges, { ...opts, minGapMs, targetGapMs, rmsSamples: opts.rmsSamples })
  return hits.map((hit) => {
    const range =
      gapShortenCutRangeWithAudio(
        hit.prevWord.t1Ms,
        hit.word.t0Ms,
        hit.gapMs,
        targetGapMs,
        opts.rmsSamples ?? null,
        opts.wordSpans,
      ) ?? null
    if (!range) return null
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
    .filter((p): p is CleanupProposal => p != null)
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
      label:
        kind === 'gap'
          ? 'Shortened pause'
          : kind === 'repeat'
            ? 'Repeat removed'
            : kind === 'filler'
              ? 'Filler removed'
              : 'Cut',
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
