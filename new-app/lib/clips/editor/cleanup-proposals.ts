import type { ClipEditsV2, CutCleanupKind, CutRange } from '@/lib/clips/edits'
import { MIN_SEGMENT_MS, mergeCutRanges, sanitizeCutRangesForTrim, subtractRangeFromCuts } from '@/lib/clips/edits'
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

import { isDefaultRemovableFiller, isPlainLightFillerToken, isReactionExclamation } from '@/lib/clips/cuts-quality/filler-classifier'
import type { CutQualityMeta } from '@/lib/clips/cuts-quality/types'
import { pauseMiddleRemovalRange, gapKeptForMotion } from '@/lib/clips/cuts-quality/pause-shorten'
import { refineWordCutWithAudio } from '@/lib/clips/editor/audio-cut-edges'

export type CleanupCutKind = 'filler' | 'repeat' | 'gap' | 'manual' | 'unknown' | 'retake' | 'clarity'

export type CleanupProposal = {
  id: string
  kind: CleanupCutKind
  range: CutRange
  label: string
  quality?: CutQualityMeta
}

export function mergeCutQualityMetaForRanges(
  prev: ClipEditsV2['cutQualityMeta'],
  ranges: CutRange[],
  metas: (CutQualityMeta | undefined)[],
): ClipEditsV2['cutQualityMeta'] {
  const next = { ...(prev ?? {}) }
  for (let i = 0; i < ranges.length; i++) {
    const m = metas[i]
    if (!m) continue
    next[proposalId(ranges[i]!)] = m
  }
  return Object.keys(next).length ? next : undefined
}

export function pruneCutQualityMeta(
  meta: ClipEditsV2['cutQualityMeta'],
  cutRanges: CutRange[],
): ClipEditsV2['cutQualityMeta'] {
  if (!meta) return undefined
  const live = new Set(cutRanges.map((r) => proposalId(r)))
  const next: NonNullable<ClipEditsV2['cutQualityMeta']> = {}
  for (const [k, v] of Object.entries(meta)) {
    if (live.has(k)) next[k] = v
  }
  return Object.keys(next).length ? next : undefined
}

/**
 * Expand a cut to MIN_SEGMENT_MS with padding if needed, without entering neighbouring
 * kept-word interiors. Returns null when the cut cannot be exported (and must not be shown).
 */
export function exportableCleanupRange(
  range: CutRange,
  neighbors?: { prevEndMs?: number; nextStartMs?: number },
  minMs: number = MIN_SEGMENT_MS,
): CutRange | null {
  const lo = Math.min(range[0], range[1])
  const hi = Math.max(range[0], range[1])
  if (hi - lo >= minMs) return [lo, hi]
  const need = minMs - (hi - lo)
  const padLeft = Math.ceil(need / 2)
  const padRight = need - padLeft
  let start = lo - padLeft
  let end = hi + padRight
  if (neighbors?.prevEndMs != null) start = Math.max(start, neighbors.prevEndMs)
  if (neighbors?.nextStartMs != null) end = Math.min(end, neighbors.nextStartMs)
  if (end - start >= minMs) return [Math.round(start), Math.round(end)]
  return null
}

export function fillersReadyForRemoveAll(rows: CleanupProposal[]): CleanupProposal[] {
  return rows.filter((row) => (row.kind === 'filler' || row.kind === 'repeat') && row.quality?.confidence === 'ready')
}

function neighborsForRange(
  range: CutRange,
  wordSpans: { s: number; e: number }[],
): { prevEndMs?: number; nextStartMs?: number } {
  const lo = Math.min(range[0], range[1])
  const hi = Math.max(range[0], range[1])
  let prevEndMs: number | undefined
  let nextStartMs: number | undefined
  for (const w of wordSpans) {
    const start = Math.round(w.s * 1000)
    const end = Math.round(w.e * 1000)
    if (end <= lo) prevEndMs = prevEndMs == null ? end : Math.max(prevEndMs, end)
    else if (start >= hi) nextStartMs = nextStartMs == null ? start : Math.min(nextStartMs, start)
  }
  return { prevEndMs, nextStartMs }
}

/** Prefer a refined cut when it still meets the export floor; otherwise keep the already-exportable original. */
function keepExportableMergeRange(
  refined: CutRange | null | undefined,
  original: CutRange,
  wordSpans: { s: number; e: number }[],
): CutRange | null {
  const width = (range: CutRange) => Math.abs(range[1] - range[0])
  if (refined && width(refined) >= MIN_SEGMENT_MS) return refined
  if (width(original) >= MIN_SEGMENT_MS) return original
  if (refined) {
    const paddedRefined = exportableCleanupRange(refined, neighborsForRange(refined, wordSpans))
    if (paddedRefined) return paddedRefined
  }
  return exportableCleanupRange(original, neighborsForRange(original, wordSpans))
}


function refineFillerRange(
  raw: CutRange,
  orderedWords: EditorWord[],
  wordIndex: number,
  rmsSamples: GapRmsSample[] | null | undefined,
  strength: CleanupStrength,
  deletedSet: Set<string>,
): { range: CutRange; quality?: CutQualityMeta } | null {
  const word = orderedWords[wordIndex]
  const prev = orderedWords[wordIndex - 1]
  const next = orderedWords[wordIndex + 1]
  const neighbors = {
    prevEndMs: prev?.t1Ms,
    nextStartMs: next?.t0Ms,
  }
  const exportable = exportableCleanupRange(raw, neighbors)
  if (!exportable) return null
  const contact = (prev != null && exportable[0] - prev.t1Ms < 40) ||
    (next != null && next.t0Ms - exportable[1] < 40)
  const reaction = Boolean(word && isReactionExclamation(word, prev, next, deletedSet))
  const plainLight = Boolean(
    word && strength === 'light' && isPlainLightFillerToken(word.text) && !reaction,
  )

  if (reaction) {
    return {
      range: exportable,
      quality: {
        srcStartMs: exportable[0],
        srcEndMs: exportable[1],
        confidence: 'needs_review',
        reason: 'reaction_exclamation',
      },
    }
  }

  // Clean Take / first-pass light: plain um/uh/er/ah are safe for Remove All even when the
  // file has no fine envelope or the ASR token abuts a neighbour (typical talking-head).
  if (plainLight) {
    return {
      range: exportable,
      quality: {
        srcStartMs: exportable[0],
        srcEndMs: exportable[1],
        confidence: 'ready',
        reason: 'light_plain_filler',
      },
    }
  }

  if (!rmsSamples?.length) {
    // With no usable audio, ASR word stamps are NOT an acoustic cut boundary.
    // Still show the proposal for individual audition, but don't put it in
    // Remove All until a human has reviewed the potentially clipped syllables.
    return { range: exportable, quality: {
      srcStartMs: exportable[0], srcEndMs: exportable[1],
      confidence: 'needs_review', reason: 'no_audio_envelope',
    } }
  }
  // SCRIPT_DOC2: the whole audible filler goes (a trailing "m" past the ASR end too); the edge
  // never enters a kept word. No quiet point = needs_review, so "Remove all" skips it.
  const audio = refineWordCutWithAudio(
    exportable,
    orderedWords.map((x) => ({ s: x.t0Ms / 1000, e: x.t1Ms / 1000 })),
    rmsSamples,
  )
  if (!audio) return { range: exportable, quality: {
    srcStartMs: exportable[0], srcEndMs: exportable[1],
    confidence: 'needs_review', reason: 'audio_alignment_unavailable',
  } }
  const audioExportable = exportableCleanupRange(audio.range, neighbors) ?? audio.range
  if ((audioExportable[1] - audioExportable[0]) < MIN_SEGMENT_MS) return null
  return {
    range: audioExportable,
    quality: {
      srcStartMs: audioExportable[0],
      srcEndMs: audioExportable[1],
      confidence: audio.confidence === 'needs_review' || contact ? 'needs_review' : 'ready',
      reason: `filler; ${audio.note}${contact ? '; word boundary touches kept speech' : ''}`,
    },
  }
}

export function proposalId(range: CutRange): string {
  const lo = Math.min(range[0], range[1])
  const hi = Math.max(range[0], range[1])
  return `${lo}:${hi}`
}

/** True when a proposal range overlaps any locked intro/outro/custom range. */
export function proposalOverlapsLockedRanges(
  range: CutRange,
  locked: Array<CutRange | { startMs: number; endMs: number }> | undefined,
): boolean {
  if (!locked?.length) return false
  const lo = Math.min(range[0], range[1])
  const hi = Math.max(range[0], range[1])
  return locked.some((item) => {
    const other = Array.isArray(item) ? item : [item.startMs, item.endMs]
    const a = Math.min(other[0], other[1])
    const b = Math.max(other[0], other[1])
    return hi > a && b > lo
  })
}

export function excludeLockedProposals<T extends { range: CutRange }>(
  proposals: T[],
  locked: Array<CutRange | { startMs: number; endMs: number }> | undefined,
): T[] {
  if (!locked?.length) return proposals
  return proposals.filter((row) => !proposalOverlapsLockedRanges(row.range, locked))
}

export function kindForAppliedCut(
  range: CutRange,
  edits: Pick<ClipEditsV2, 'cutCleanupKinds'>,
  orderedWords: EditorWord[],
  deletedSet: Set<string>,
): CleanupCutKind {
  const id = proposalId(range)
  const stored = edits.cutCleanupKinds?.[id]
  if (stored && stored !== 'manual') return stored
  const inferred = classifyCut(range, orderedWords, deletedSet)
  return inferred === 'unknown' ? stored ?? 'manual' : inferred
}

export function mergeCutCleanupKindsForRanges(
  prev: ClipEditsV2['cutCleanupKinds'],
  ranges: CutRange[],
  kinds: CleanupCutKind[],
): ClipEditsV2['cutCleanupKinds'] {
  const next: Record<string, CutCleanupKind> = { ...(prev ?? {}) }
  for (let i = 0; i < ranges.length; i++) {
    const kind = kinds[i]
    if (!kind) continue
    next[proposalId(ranges[i]!)] = kind
  }
  return Object.keys(next).length ? next : undefined
}

const CLEANUP_KIND_MERGE_PRIORITY: CleanupCutKind[] = [
  'retake',
  'clarity',
  'repeat',
  'filler',
  'gap',
  'manual',
  'unknown',
]

function mergeCleanupKind(a: CleanupCutKind, b: CleanupCutKind): CleanupCutKind {
  const ia = CLEANUP_KIND_MERGE_PRIORITY.indexOf(a)
  const ib = CLEANUP_KIND_MERGE_PRIORITY.indexOf(b)
  if (ia < 0) return b
  if (ib < 0) return a
  return ia <= ib ? a : b
}

function rangesOverlap(a: CutRange, b: CutRange): boolean {
  const loA = Math.min(a[0], a[1])
  const hiA = Math.max(a[0], a[1])
  const loB = Math.min(b[0], b[1])
  const hiB = Math.max(b[0], b[1])
  return hiA > loB && hiB > loA
}

/**
 * After `mergeCutRanges` coalesces cuts, proposal ids change and `pruneCutCleanupKinds` drops tags.
 * Re-attach the best cleanup kind from any overlapping previous/applied range (never downgrade filler/repeat → manual).
 */
export function reconcileCutCleanupKinds(
  meta: ClipEditsV2['cutCleanupKinds'],
  prevCuts: CutRange[],
  nextCuts: CutRange[],
  applied?: { range: CutRange; kind: CleanupCutKind }[],
): ClipEditsV2['cutCleanupKinds'] {
  const tagged: { range: CutRange; kind: CleanupCutKind }[] = []
  for (const r of prevCuts) {
    const k = meta?.[proposalId(r)]
    if (k) tagged.push({ range: r, kind: k })
  }
  for (const row of applied ?? []) {
    const kind = row.kind === 'unknown' ? 'manual' : row.kind
    tagged.push({ range: row.range, kind })
  }
  const next: Record<string, CutCleanupKind> = {}
  for (const r of nextCuts) {
    const id = proposalId(r)
    const direct = meta?.[id]
    if (direct && direct !== 'manual') {
      next[id] = direct
      continue
    }
    let kind: CleanupCutKind | null = direct ?? null
    for (const src of tagged) {
      if (!rangesOverlap(r, src.range)) continue
      kind = kind ? mergeCleanupKind(kind, src.kind) : src.kind
    }
    if (kind && kind !== 'unknown') next[id] = kind
  }
  return Object.keys(next).length ? next : undefined
}

export function pruneCutCleanupKinds(
  meta: ClipEditsV2['cutCleanupKinds'],
  cutRanges: CutRange[],
): ClipEditsV2['cutCleanupKinds'] {
  if (!meta) return undefined
  const live = new Set(cutRanges.map((r) => proposalId(r)))
  const next: Record<string, CutCleanupKind> = {}
  for (const [k, v] of Object.entries(meta)) {
    if (live.has(k)) next[k] = v
  }
  return Object.keys(next).length ? next : undefined
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
    rmsSamples?: GapRmsSample[] | null
    lockedRanges?: Array<CutRange | { startMs: number; endMs: number }>
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
    if (
      h.word.fillerKind === 'lexicon' &&
      strength === 'normal' &&
      !isDefaultRemovableFiller(h.word, orderedWords, i, deletedSet) &&
      !enabledOptIn.has(normalizeToken(h.word.text))
    ) {
      continue
    }

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
    const refined = refineFillerRange(raw, orderedWords, i, opts?.rmsSamples, strength, deletedSet)
    usedIndices.add(i)
    if (!refined) continue
    out.push({
      id: proposalId(refined.range),
      kind: 'filler',
      range: refined.range,
      label: h.word.text.trim() || 'filler',
      quality: refined.quality,
    })
  }
  return excludeLockedProposals(out, opts?.lockedRanges)
}

export function retakeProposals(
  groups: RetakeGroup[],
  existingCuts: CutRange[] = [],
  opts?: { lockedRanges?: Array<CutRange | { startMs: number; endMs: number }> },
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
  return excludeLockedProposals(out, opts?.lockedRanges)
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
    motionSamples?: { tMs: number; lumaDiff: number }[] | null
    lockedRanges?: Array<CutRange | { startMs: number; endMs: number }>
  },
): CleanupProposal[] {
  const preset = opts.strength ? gapPresetForStrength(opts.strength) : null
  const minGapMs = preset?.minGapMs ?? opts.minGapMs
  // SCRIPT_DOC2: the user's "keep pauses at least" length is a floor; a strength preset never goes below it.
  const targetGapMs = Math.max(opts.targetGapMs, preset?.targetGapMs ?? 0)
  const hits = listClipGapHits(orderedWords, cutRanges, { ...opts, minGapMs, targetGapMs, rmsSamples: opts.rmsSamples })
  const filtered = hits
    .map((hit) => {
      if (gapKeptForMotion(opts.motionSamples?.filter((s) => s.tMs >= hit.prevWord.t1Ms && s.tMs <= hit.word.t0Ms))) {
        return null
      }
      const range =
        gapShortenCutRangeWithAudio(
          hit.prevWord.t1Ms,
          hit.word.t0Ms,
          hit.gapMs,
          targetGapMs,
          opts.rmsSamples ?? null,
          opts.wordSpans,
        ) ??
        // SCRIPT_DOC2: a transcript gap is only a candidate. When audio levels were passed, only the
        // audio-checked range above may cut; never fall back to a blind middle cut.
        (opts.rmsSamples === undefined
          ? pauseMiddleRemovalRange(hit.prevWord.t1Ms, hit.word.t0Ms, hit.gapMs, targetGapMs)
          : null)
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
      quality: {
        srcStartMs: normalized[0],
        srcEndMs: normalized[1],
        confidence: 'ready',
        reason: 'gap_shorten',
      },
    }
  })
    .filter((p): p is CleanupProposal => p != null)
  return excludeLockedProposals(filtered, opts.lockedRanges)
}

export function appliedCutProposals(
  edits: ClipEditsV2,
  orderedWords: EditorWord[],
  deletedSet: Set<string>,
): CleanupProposal[] {
  const out: CleanupProposal[] = []
  for (const range of edits.cutRanges) {
    const kind = kindForAppliedCut(range, edits, orderedWords, deletedSet)
    const label =
      kind === 'gap'
        ? 'Shortened pause'
        : kind === 'repeat'
          ? 'Repeat removed'
          : kind === 'filler'
            ? 'Filler removed'
            : kind === 'retake'
              ? 'Retake removed'
              : kind === 'clarity'
                ? 'Clarity edit'
                : 'Cut'
    out.push({
      id: proposalId(range),
      kind,
      range,
      label,
    })
  }
  return out
}

export function mergeCleanupCutRanges(
  baseCuts: CutRange[],
  ranges: CutRange[],
  wordSpans: { s: number; e: number; w?: string }[],
  opts?: { rmsSamples?: GapRmsSample[] | null },
): CutRange[] {
  let cuts = [...baseCuts]
  for (const range of ranges) {
    // SCRIPT_DOC2: whole-word cuts (transcript delete, filler, retake) take their edges from the
    // audio instead of fixed pads. The result never enters a kept word, so the worker's
    // sanitize_cut_ranges keeps it as-is and the export cuts where the preview cuts.
    const audio = wordSpans.length > 0 ? refineWordCutWithAudio(range, wordSpans, opts?.rmsSamples) : null
    let nextRange: CutRange | null = null
    if (audio) {
      nextRange = audio.range
    } else if (wordSpans.length > 0) {
      const snapped =
        normalizeCleanupCutRange(range, wordSpans) ?? snapCutRangeToWordGaps(range, wordSpans) ?? range
      nextRange =
        sanitizeCleanupCutRanges([snapped], wordSpans)[0] ??
        sanitizeCutRangesForWords([snapped], wordSpans)[0] ??
        snapped
    } else {
      nextRange = range
    }
    const kept = keepExportableMergeRange(nextRange, range, wordSpans)
    if (kept) cuts = mergeCutRanges([...cuts, kept])
  }
  return cuts
}

export function applyProposalsToEdits(
  edits: ClipEditsV2,
  proposals: CleanupProposal[],
  wordSpans: { s: number; e: number; w?: string }[],
  rmsSamples?: GapRmsSample[] | null,
): ClipEditsV2 {
  const ranges = proposals.map((p) => p.range)
  return { ...edits, cutRanges: mergeCleanupCutRanges(edits.cutRanges, ranges, wordSpans, { rmsSamples }) }
}

export function auditionEditsForProposals(
  edits: ClipEditsV2,
  proposals: CleanupProposal[],
  wordSpans: { s: number; e: number; w?: string }[],
  rmsSamples?: GapRmsSample[] | null,
): ClipEditsV2 {
  return applyProposalsToEdits(edits, proposals, wordSpans, rmsSamples)
}

/** Removal ranges that export will actually keep (same refine + MIN_SEGMENT_MS floor as apply/export). */
export function exportCutRangesFromProposals(
  edits: ClipEditsV2,
  proposals: CleanupProposal[],
  wordSpans: { s: number; e: number; w?: string }[],
  rmsSamples?: GapRmsSample[] | null,
): CutRange[] {
  const next = applyProposalsToEdits(edits, proposals, wordSpans, rmsSamples)
  let cuts = sanitizeCutRangesForTrim(next.cutRanges, edits.trim.in, edits.trim.out)
  const missing = proposals
    .map((proposal) => proposal.range)
    .filter((range) => {
      const lo = Math.min(range[0], range[1])
      const hi = Math.max(range[0], range[1])
      if (hi - lo < MIN_SEGMENT_MS) return false
      return !cuts.some((cut: CutRange) => Math.min(cut[1], hi) - Math.max(cut[0], lo) > 0)
    })
  if (missing.length) {
    cuts = sanitizeCutRangesForTrim(mergeCutRanges([...cuts, ...missing]), edits.trim.in, edits.trim.out)
  }
  return cuts
}

export function restoreCleanupProposal(edits: ClipEditsV2, range: CutRange): ClipEditsV2 {
  const next: ClipEditsV2 = { ...edits, cutRanges: subtractRangeFromCuts(edits.cutRanges, range) }
  if (Array.isArray(edits.cleanTakeAiRanges)) {
    next.cleanTakeAiRanges = subtractRangeFromCuts(edits.cleanTakeAiRanges, range)
  }
  return next
}

/** Export-refined (padded) range for one proposal — the same cut audition and export keep. */
export function exportRefinedRangeForProposal(
  edits: ClipEditsV2,
  proposal: CleanupProposal,
  wordSpans: { s: number; e: number; w?: string }[],
  rmsSamples?: GapRmsSample[] | null,
): CutRange {
  const cuts = exportCutRangesFromProposals(
    { ...edits, cutRanges: [] },
    [proposal],
    wordSpans,
    rmsSamples,
  )
  return cuts[0] ?? proposal.range
}

/** Restore by subtracting the export-refined range, not the tighter displayed proposal range. */
export function restoreCleanupProposalMatchingExport(
  edits: ClipEditsV2,
  proposal: CleanupProposal,
  wordSpans: { s: number; e: number; w?: string }[],
  rmsSamples?: GapRmsSample[] | null,
): ClipEditsV2 {
  return restoreCleanupProposal(
    edits,
    exportRefinedRangeForProposal(edits, proposal, wordSpans, rmsSamples),
  )
}
