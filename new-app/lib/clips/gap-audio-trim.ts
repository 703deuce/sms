import type { CutRange } from '@/lib/clips/edits'
import { snapCutRangeToWordGaps } from '@/lib/clips/word-cut'

/** Minimum loudness threshold (−40 dBFS on a 0..1 peak scale). */
export const GAP_QUIET_MIN_LINEAR = 10 ** (-40 / 20)

export type GapRmsSample = { tMs: number; rms: number }

const SAMPLE_MS = 25

/** Build ~25 ms RMS samples from a normalized peak envelope (0..1). */
export function rmsSamplesFromPeaks(peaks: number[], peaksPerSec: number): GapRmsSample[] {
  if (!peaks.length || !(peaksPerSec > 0)) return []
  const step = Math.max(1, Math.round((peaksPerSec * SAMPLE_MS) / 1000))
  const out: GapRmsSample[] = []
  for (let i = 0; i < peaks.length; i += step) {
    let peak = 0
    for (let j = i; j < Math.min(peaks.length, i + step); j++) peak = Math.max(peak, peaks[j] ?? 0)
    out.push({ tMs: (i / peaksPerSec) * 1000, rms: peak })
  }
  return out
}

function samplesInGap(
  gapStartMs: number,
  gapEndMs: number,
  rmsSamples: GapRmsSample[],
): GapRmsSample[] {
  return rmsSamples.filter((s) => s.tMs >= gapStartMs && s.tMs <= gapEndMs)
}

/** Noise floor (linear) from the quiet tail of samples in this gap. */
export function gapNoiseFloorLinear(samples: GapRmsSample[]): number {
  if (!samples.length) return GAP_QUIET_MIN_LINEAR
  const sorted = samples.map((s) => s.rms).sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * 0.1)))
  return Math.max(GAP_QUIET_MIN_LINEAR / 4, sorted[idx] ?? GAP_QUIET_MIN_LINEAR)
}

/** Cut threshold: max(noise floor + 6 dB, −40 dBFS). */
export function gapQuietThresholdLinear(noiseFloor: number): number {
  const nfDb = 20 * Math.log10(Math.max(noiseFloor, 1e-9))
  const thrDb = Math.max(nfDb + 6, -40)
  return 10 ** (thrDb / 20)
}

/** Shared RMS gate for gap lists (Cleanup + Polish shorten gaps). */
export function gapHitIsRmsQuiet(
  gapStartMs: number,
  gapEndMs: number,
  rmsSamples: GapRmsSample[] | null | undefined,
): boolean {
  if (rmsSamples === undefined) return true
  if (!rmsSamples?.length) return false
  return !gapHasLoudProgramAudio(gapStartMs, gapEndMs, rmsSamples)
}

export function gapHasLoudProgramAudio(
  gapStartMs: number,
  gapEndMs: number,
  rmsSamples: GapRmsSample[] | null | undefined,
): boolean {
  const samples = rmsSamples?.length ? samplesInGap(gapStartMs, gapEndMs, rmsSamples) : []
  if (!samples.length) return false
  const thr = gapQuietThresholdLinear(gapNoiseFloorLinear(samples))
  let loudMs = 0
  for (const s of samples) {
    if (s.rms > thr) loudMs += SAMPLE_MS
  }
  if (loudMs > 150) return true
  const sorted = samples.map((s) => s.rms).sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0
  return median > GAP_QUIET_MIN_LINEAR * 2
}

type Interval = { lo: number; hi: number }

function mergeIntervals(intervals: Interval[]): Interval[] {
  if (!intervals.length) return []
  const sorted = [...intervals].sort((a, b) => a.lo - b.lo)
  const out: Interval[] = [sorted[0]!]
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!
    const last = out[out.length - 1]!
    if (cur.lo <= last.hi + 1) last.hi = Math.max(last.hi, cur.hi)
    else out.push(cur)
  }
  return out
}

function quietIntervalsInGap(
  gapStartMs: number,
  gapEndMs: number,
  rmsSamples: GapRmsSample[],
): Interval[] {
  const samples = samplesInGap(gapStartMs, gapEndMs, rmsSamples)
  if (!samples.length) return [{ lo: gapStartMs, hi: gapEndMs }]
  const thr = gapQuietThresholdLinear(gapNoiseFloorLinear(samples))
  const quiet: Interval[] = []
  for (const s of samples) {
    if (s.rms <= thr) {
      const lo = Math.max(gapStartMs, Math.round(s.tMs - SAMPLE_MS / 2))
      const hi = Math.min(gapEndMs, Math.round(s.tMs + SAMPLE_MS / 2))
      if (hi > lo) quiet.push({ lo, hi })
    }
  }
  return mergeIntervals(quiet)
}

function intervalLen(i: Interval): number {
  return Math.max(0, i.hi - i.lo)
}

function pickQuietCutRange(quiet: Interval[], removeMs: number, gapMid: number): CutRange | null {
  if (removeMs <= 40 || !quiet.length) return null
  let best: CutRange | null = null
  let bestDist = Infinity
  for (const q of quiet) {
    const len = intervalLen(q)
    if (len < removeMs + 20) continue
    const mid = q.lo + len / 2
    let lo = Math.round(mid - removeMs / 2)
    let hi = Math.round(mid + removeMs / 2)
    lo = Math.max(q.lo, lo)
    hi = Math.min(q.hi, hi)
    if (hi - lo < 40) continue
    const dist = Math.abs(mid - gapMid)
    if (dist < bestDist) {
      bestDist = dist
      best = [lo, hi]
    }
  }
  if (best) return best
  // Span multiple quiet islands — take from the longest quiet run near center.
  const sorted = [...quiet].sort((a, b) => intervalLen(b) - intervalLen(a))
  for (const q of sorted) {
    const len = intervalLen(q)
    const take = Math.min(removeMs, len - 40)
    if (take <= 40) continue
    const mid = q.lo + len / 2
    let lo = Math.round(mid - take / 2)
    let hi = Math.round(mid + take / 2)
    lo = Math.max(q.lo, lo)
    hi = Math.min(q.hi, hi)
    if (hi - lo >= 40) return [lo, hi]
  }
  return null
}

/**
 * Shorten a transcript gap using program audio: only remove samples below the noise-aware
 * threshold; gaps with sustained game/music/SFX are kept intact.
 */
export function gapShortenCutRangeWithAudio(
  gapStartMs: number,
  gapEndMs: number,
  gapMs: number,
  targetGapMs: number,
  rmsSamples: GapRmsSample[] | null | undefined,
  words?: { s: number; e: number }[],
): CutRange | null {
  if (gapMs <= targetGapMs + 50) return null
  if (rmsSamples !== undefined) {
    if (!rmsSamples?.length) return null
    if (gapHasLoudProgramAudio(gapStartMs, gapEndMs, rmsSamples)) return null
    const quiet = quietIntervalsInGap(gapStartMs, gapEndMs, rmsSamples)
    const quietMs = quiet.reduce((n, q) => n + intervalLen(q), 0)
    const loudMs = Math.max(0, gapMs - quietMs)
    const needRemove = gapMs - targetGapMs
    const maxRemove = Math.min(needRemove, quietMs - Math.max(0, targetGapMs - loudMs))
    if (maxRemove <= 50) return null
    const mid = gapStartMs + gapMs / 2
    const raw = pickQuietCutRange(quiet, Math.round(maxRemove), mid)
    if (!raw) return null
    if (words?.length) {
      const snapped = snapCutRangeToWordGaps(raw, words, 60) ?? raw
      return [
        Math.max(gapStartMs, snapped[0]),
        Math.min(gapEndMs, snapped[1]),
      ] as CutRange
    }
    return raw
  }
  return null
}

/** Total ms removed by merging cut ranges within [trimIn, trimOut). */
export function mergedCutRemovalMs(ranges: CutRange[], trimIn: number, trimOut: number): number {
  const clipped = ranges
    .map(([a, b]) => {
      const lo = Math.max(trimIn, Math.min(a, b))
      const hi = Math.min(trimOut, Math.max(a, b))
      return hi > lo ? ([lo, hi] as CutRange) : null
    })
    .filter((r): r is CutRange => r != null)
  const merged = mergeIntervals(clipped.map(([lo, hi]) => ({ lo, hi })))
  return merged.reduce((n, i) => n + intervalLen(i), 0)
}

export function cleanupPassConfirmMessage(removedMs: number, sourceDurationMs: number): string {
  const removedS = Math.round(removedMs / 1000)
  const totalS = Math.round(sourceDurationMs / 1000)
  return `This removes ${removedS} s of ${totalS} s. Continue?`
}

export function cleanupPassNeedsConfirm(removedMs: number, sourceDurationMs: number): boolean {
  if (sourceDurationMs <= 0) return false
  return removedMs / sourceDurationMs > 0.25
}
