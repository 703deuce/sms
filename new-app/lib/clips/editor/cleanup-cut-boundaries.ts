/**
 * Shared cleanup cut geometry (preview + export). TB-04/05 AI_QUALITY Q1.
 */
import type { CutRange } from '@/lib/clips/edits'
import { cutIntersectsWordInterior, WORD_CUT_MIN_MS } from '@/lib/clips/word-cut'

export const CLEANUP_CUT_PRE_PAD_MS = 30
export const CLEANUP_CUT_POST_PAD_MS = 60
export const CLEANUP_RMS_WINDOW_MS = 120
export const CLEANUP_SPEECH_GAP_RMS_MS = 150

export type CleanupWordSpan = { s: number; e: number; w?: string }

function spanMs(w: CleanupWordSpan): [number, number] {
  return [Math.round(w.s * 1000), Math.round(w.e * 1000)]
}

function sortedWords(words: CleanupWordSpan[]): CleanupWordSpan[] {
  return [...words].sort((a, b) => a.s - b.s)
}

/** Midpoint of silence between two word spans (ms). */
export function gapMidpointMs(prevEndMs: number, nextStartMs: number): number {
  return Math.round((prevEndMs + nextStartMs) / 2)
}

/**
 * Snap cut edges into inter-word silence with asymmetric pads (30 ms before next word, 60 ms after prev).
 */
export function snapCleanupCutRange(
  range: CutRange,
  words: CleanupWordSpan[],
  opts?: { prePadMs?: number; postPadMs?: number },
): CutRange | null {
  const prePad = opts?.prePadMs ?? CLEANUP_CUT_PRE_PAD_MS
  const postPad = opts?.postPadMs ?? CLEANUP_CUT_POST_PAD_MS
  const [a, b] = range
  let lo = Math.min(a, b)
  let hi = Math.max(a, b)
  if (hi - lo < WORD_CUT_MIN_MS) return null
  const sorted = sortedWords(words)
  if (!sorted.length) return range

  for (let i = 0; i < sorted.length; i++) {
    const [ws, we] = spanMs(sorted[i])
    if (we <= lo || ws >= hi) continue
    if (ws > lo) lo = Math.min(hi, ws + prePad)
    if (we < hi) hi = Math.max(lo, we + postPad)
  }

  if (hi - lo < WORD_CUT_MIN_MS) return null
  if (cutIntersectsWordInterior([lo, hi], sorted)) return null
  return [Math.round(lo), Math.round(hi)]
}

/** Extend cut toward low-RMS tail when ASR span is shorter than acoustic filler (optional RMS). */
export function extendCutForFillerFragment(
  range: CutRange,
  asrStartMs: number,
  asrEndMs: number,
  rmsSamples?: { tMs: number; rms: number }[] | null,
  noiseFloor = 0.08,
): CutRange {
  if (!rmsSamples?.length) return range
  const winStart = asrStartMs - CLEANUP_RMS_WINDOW_MS
  const winEnd = asrEndMs + CLEANUP_RMS_WINDOW_MS
  const inWin = rmsSamples.filter((s) => s.tMs >= winStart && s.tMs <= winEnd)
  if (!inWin.length) return range

  let acousticEnd = asrEndMs
  for (const s of inWin) {
    if (s.tMs >= asrEndMs && s.rms > noiseFloor) acousticEnd = Math.max(acousticEnd, s.tMs)
  }
  if (acousticEnd <= asrEndMs + 15) return range

  const [lo, hi] = range
  return [lo, Math.max(hi, acousticEnd)] as CutRange
}

function isExactWordSpan(range: CutRange, words: CleanupWordSpan[]): boolean {
  const [a, b] = range
  for (const w of words) {
    const [ws, we] = spanMs(w)
    if (ws === a && we === b) return true
  }
  return false
}

export function normalizeCleanupCutRange(
  range: CutRange,
  words: CleanupWordSpan[],
  opts?: {
    prePadMs?: number
    postPadMs?: number
    asrStartMs?: number
    asrEndMs?: number
    rmsSamples?: { tMs: number; rms: number }[] | null
  },
): CutRange | null {
  let r = range
  if (opts?.asrStartMs != null && opts?.asrEndMs != null) {
    r = extendCutForFillerFragment(r, opts.asrStartMs, opts.asrEndMs, opts.rmsSamples)
  }
  if (isExactWordSpan(r, words)) return r
  return snapCleanupCutRange(r, words, opts)
}

export function sanitizeCleanupCutRanges(
  cuts: CutRange[],
  words: CleanupWordSpan[],
): CutRange[] {
  const out: CutRange[] = []
  for (const c of cuts) {
    const n = normalizeCleanupCutRange(c, words)
    if (n) out.push(n)
  }
  return out
}
