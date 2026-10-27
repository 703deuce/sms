import { mergeCutRanges, type ClipEditsV2, type ClipWord } from '@/lib/clips/edits'

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

export function fillerWordCutRanges(
  words: { s: number; e: number; w?: string }[],
): [number, number][] {
  const cuts: [number, number][] = []
  for (const w of words) {
    const text = (w.w ?? '').trim()
    if (!text || !FILLER_ONLY_RE.test(text)) continue
    const a = Math.round(w.s * 1000)
    const b = Math.round(w.e * 1000)
    if (b - a > 30) cuts.push([a, b])
  }
  return cuts
}

export function silenceTrimCutRanges(
  words: { s: number; e: number }[],
  opts: SilenceTrimSettings,
): [number, number][] {
  if (!opts.enabled) return []
  const minGap = opts.minGapMs ?? SILENCE_TRIM_NATURAL.minGapMs ?? 350
  const keep = opts.keepMs ?? SILENCE_TRIM_NATURAL.keepMs ?? 120
  const cuts: [number, number][] = []
  for (let i = 0; i < words.length - 1; i++) {
    const gapStart = words[i].e * 1000
    const gapEnd = words[i + 1].s * 1000
    const gap = gapEnd - gapStart
    if (opts.protectReactionGaps && gap < minGap + 200) continue
    if (gap <= minGap) continue
    const remove = gap - keep
    if (remove <= 50) continue
    const mid = gapStart + gap / 2
    cuts.push([Math.round(mid - remove / 2), Math.round(mid + remove / 2)])
  }
  return cuts
}

export function applySilenceTrimToEdits(
  edits: ClipEditsV2,
  words: ClipWord[],
  opts?: SilenceTrimSettings,
): ClipEditsV2 {
  const settings = { ...edits.silenceTrim, ...opts, enabled: true }
  const wordMs = words.map((w) => ({ s: w.s, e: w.e, w: w.w }))
  const extra = [
    ...silenceTrimCutRanges(wordMs, settings),
    ...(settings.fillerTrim ? fillerWordCutRanges(wordMs) : []),
  ]
  if (!extra.length) return { ...edits, silenceTrim: settings }
  return {
    ...edits,
    silenceTrim: settings,
    cutRanges: mergeCutRanges([...edits.cutRanges, ...extra]),
  }
}
