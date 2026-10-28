import { mergeCutRanges, sanitizeCutRangesForTrim, type ClipEditsV2, type ClipWord, type CutRange } from '@/lib/clips/edits'
import { maxPlausibleGapMsForTrim } from '@/lib/clips/editor/clip-editor-word-scope'
import { sanitizeCutRangesForWords, snapCutRangeToWordGaps } from '@/lib/clips/word-cut'

/** Gap cuts between words for silence trimming (ms on source timeline). */
export type SilenceTrimSettings = {
  enabled?: boolean
  minGapMs?: number
  keepMs?: number
  /** Cut isolated um/uh/erm tokens (Whisper timings). */
  fillerTrim?: boolean
  /** Stream: slightly longer gaps before cuts (keeps pre-reaction pauses). */
  protectReactionGaps?: boolean
}

export type SilenceTrimContext = {
  trimIn: number
  trimOut: number
  protectedSpans?: CutRange[]
}

/** Polished clip "Natural" — gaps >350ms shrink to ~120ms. */
export const SILENCE_TRIM_NATURAL: SilenceTrimSettings = {
  enabled: true,
  minGapMs: 350,
  keepMs: 120,
  fillerTrim: true,
}

/** Gentler for stream/reaction timing. */
export const SILENCE_TRIM_STREAM_GENTLE: SilenceTrimSettings = {
  enabled: true,
  minGapMs: 520,
  keepMs: 180,
  fillerTrim: true,
  protectReactionGaps: true,
}

const FILLER_ONLY_RE = /^(um|uh|erm|hmm|mm|mhm)$/i

function cutOverlapsProtectedSpan(cut: CutRange, spans: CutRange[] | undefined): boolean {
  if (!spans?.length) return false
  const [a, b] = cut
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  for (const [ps, pe] of spans) {
    const slo = Math.min(ps, pe)
    const shi = Math.max(ps, pe)
    if (hi <= slo || lo >= shi) continue
    const overlap = Math.min(hi, shi) - Math.max(lo, slo)
    if (overlap >= 120) return true
  }
  return false
}

/** Gemini / visual payoff windows — do not silence-trim inside these spans. */
export function protectedContentSpansFromAiMeta(aiMeta: unknown, rangeStartMs = 0): CutRange[] {
  if (!aiMeta || typeof aiMeta !== 'object') return []
  const meta = aiMeta as Record<string, unknown>
  const spans: CutRange[] = []
  const setup = meta.boundary_setup_ms ?? meta.boundarySetupMs
  const payoff = meta.boundary_payoff_ms ?? meta.boundaryPayoffMs
  if (typeof setup === 'number' && typeof payoff === 'number' && payoff > setup) {
    spans.push([Math.round(setup), Math.round(payoff)])
  }
  const vms = meta.visualMoments ?? meta.visual_moments
  if (Array.isArray(vms)) {
    for (const row of vms) {
      if (!row || typeof row !== 'object') continue
      const m = row as Record<string, unknown>
      const startS = Number(m.start_s ?? m.startS ?? NaN)
      const endS = Number(m.end_s ?? m.endS ?? startS)
      if (!Number.isFinite(startS)) continue
      const sMs = Math.round(startS * 1000) + rangeStartMs
      const eMs = Math.round((Number.isFinite(endS) ? endS : startS) * 1000) + rangeStartMs
      if (eMs > sMs) spans.push([sMs, eMs])
    }
  }
  return spans
}

export function fillerWordCutRanges(
  words: { s: number; e: number; w?: string }[],
  ctx?: SilenceTrimContext,
): CutRange[] {
  const cuts: CutRange[] = []
  for (const w of words) {
    const text = (w.w ?? '').trim()
    if (!text || !FILLER_ONLY_RE.test(text)) continue
    const a = Math.round(w.s * 1000)
    const b = Math.round(w.e * 1000)
    if (b - a > 30) cuts.push([a, b])
  }
  if (!ctx) return cuts
  return sanitizeCutRangesForTrim(cuts, ctx.trimIn, ctx.trimOut).filter(
    (c) => !cutOverlapsProtectedSpan(c, ctx.protectedSpans),
  )
}

export function silenceTrimCutRanges(
  words: { s: number; e: number }[],
  opts: SilenceTrimSettings,
  ctx?: SilenceTrimContext,
): CutRange[] {
  if (!opts.enabled) return []
  const trimIn = ctx?.trimIn ?? 0
  const trimOut = ctx?.trimOut ?? Number.MAX_SAFE_INTEGER
  const maxGapMs = maxPlausibleGapMsForTrim({ in: trimIn, out: trimOut })
  const minGap = opts.minGapMs ?? SILENCE_TRIM_NATURAL.minGapMs ?? 350
  const keep = opts.keepMs ?? SILENCE_TRIM_NATURAL.keepMs ?? 120
  const cuts: CutRange[] = []
  for (let i = 0; i < words.length - 1; i++) {
    const gapStart = words[i].e * 1000
    const gapEnd = words[i + 1].s * 1000
    if (gapEnd <= trimIn || gapStart >= trimOut) continue
    const gap = gapEnd - gapStart
    if (gap > maxGapMs) continue
    if (opts.protectReactionGaps && gap < minGap + 200) continue
    if (gap <= minGap) continue
    const remove = gap - keep
    if (remove <= 50) continue
    const mid = gapStart + gap / 2
    const raw: CutRange = [Math.round(mid - remove / 2), Math.round(mid + remove / 2)]
    if (cutOverlapsProtectedSpan(raw, ctx?.protectedSpans)) continue
    const snapped = snapCutRangeToWordGaps(raw, words, 60)
    if (snapped && !cutOverlapsProtectedSpan(snapped, ctx?.protectedSpans)) cuts.push(snapped)
  }
  return sanitizeCutRangesForTrim(cuts, trimIn, trimOut)
}

export function applySilenceTrimToEdits(
  edits: ClipEditsV2,
  words: ClipWord[],
  opts?: SilenceTrimSettings & { aiMeta?: unknown; rangeStartMs?: number },
): ClipEditsV2 {
  const settings = { ...edits.silenceTrim, ...opts, enabled: true }
  const trimIn = edits.trim.in
  const trimOut = edits.trim.out
  const protectedSpans = protectedContentSpansFromAiMeta(opts?.aiMeta, opts?.rangeStartMs ?? 0)
  const ctx: SilenceTrimContext = { trimIn, trimOut, protectedSpans }
  const inTrimWords = words.filter((w) => w.e * 1000 > trimIn + 15 && w.s * 1000 < trimOut - 15)
  const wordMs = inTrimWords.map((w) => ({ s: w.s, e: w.e, w: w.w }))
  const extra = sanitizeCutRangesForWords(
    [
      ...silenceTrimCutRanges(wordMs, settings, ctx),
      ...(settings.fillerTrim ? fillerWordCutRanges(wordMs, ctx) : []),
    ],
    wordMs,
  )
  const merged = mergeCutRanges([
    ...sanitizeCutRangesForTrim(edits.cutRanges, trimIn, trimOut),
    ...extra,
  ])
  if (!extra.length && merged.length === edits.cutRanges.length) {
    return { ...edits, silenceTrim: settings, cutRanges: merged }
  }
  return {
    ...edits,
    silenceTrim: settings,
    cutRanges: merged,
  }
}
