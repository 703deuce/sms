/**
 * CUTS_QUALITY1 §1: RMS-aware cut edges with confidence (shared filler + word deletes).
 * Operates on mono peak/RMS samples (~10 ms frames); decodes are done by the caller (peaks URL / worker PCM).
 */
import type { CutConfidence, CutQualityMeta } from '@/lib/clips/cuts-quality/types'

export const FRAME_MS = 10
export const HOP_MS = 5
export const MIN_ROOM_TONE_MS = 20
export const SPEECH_DB_ABOVE_FLOOR = 8
export const NEIGHBOR_INTRUSION_MS = 30

export type RmsFrame = { tMs: number; rms: number }

export type WordNeighbor = {
  prevEndMs: number | null
  wordStartMs: number
  wordEndMs: number
  nextStartMs: number | null
}

function dbToLinear(db: number): number {
  return 10 ** (db / 20)
}

function linearToDb(l: number): number {
  return 20 * Math.log10(Math.max(l, 1e-12))
}

/** Resample irregular peaks to ~10 ms frames (max peak in each window). */
export function framesFromSamples(samples: RmsFrame[], frameMs = FRAME_MS, hopMs = HOP_MS): RmsFrame[] {
  if (!samples.length) return []
  const sorted = [...samples].sort((a, b) => a.tMs - b.tMs)
  const t0 = sorted[0]!.tMs
  const t1 = sorted[sorted.length - 1]!.tMs
  const out: RmsFrame[] = []
  for (let t = t0; t <= t1; t += hopMs) {
    const hi = t + frameMs
    let peak = 0
    for (const s of sorted) {
      if (s.tMs < t) continue
      if (s.tMs >= hi) break
      peak = Math.max(peak, s.rms)
    }
    out.push({ tMs: t, rms: peak })
  }
  return out
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)))
  return sorted[idx] ?? 0
}

export function noiseFloorForWindow(frames: RmsFrame[], centerMs: number, windowMs = 2000): number {
  const lo = centerMs - windowMs / 2
  const hi = centerMs + windowMs / 2
  const vals = frames.filter((f) => f.tMs >= lo && f.tMs <= hi).map((f) => f.rms)
  return percentile(vals, 0.1)
}

export function speechThresholdLinear(floor: number): number {
  const thrDb = linearToDb(floor) + SPEECH_DB_ABOVE_FLOOR
  return dbToLinear(thrDb)
}

function snapZeroCrossing(frames: RmsFrame[], edgeMs: number, searchMs = 2): number {
  const near = frames.filter((f) => Math.abs(f.tMs - edgeMs) <= searchMs)
  if (near.length < 2) return edgeMs
  let best = edgeMs
  let bestRms = Infinity
  for (const f of near) {
    if (f.rms < bestRms) {
      bestRms = f.rms
      best = f.tMs
    }
  }
  return Math.round(best)
}

function lowestValleyMs(
  frames: RmsFrame[],
  loMs: number,
  hiMs: number,
  threshold: number,
): number | null {
  const slice = frames.filter((f) => f.tMs >= loMs && f.tMs <= hiMs)
  if (!slice.length) return null
  let best: RmsFrame | null = null
  for (const f of slice) {
    if (f.rms > threshold) continue
    if (!best || f.rms < best.rms) best = f
  }
  return best ? best.tMs : null
}

function applyRoomTonePad(edge: number, neighborMs: number, isStart: boolean): number {
  const gap = Math.abs(edge - neighborMs)
  if (gap < MIN_ROOM_TONE_MS * 2) return edge
  return isStart ? edge - MIN_ROOM_TONE_MS : edge + MIN_ROOM_TONE_MS
}

export type RefineCutInput = {
  neighbors: WordNeighbor
  frames: RmsFrame[]
  reason: string
}

export function refineCutBoundary(input: RefineCutInput): { range: [number, number]; meta: CutQualityMeta } {
  const { neighbors: n, frames, reason } = input
  const center = (n.wordStartMs + n.wordEndMs) / 2
  const floor = noiseFloorForWindow(frames, center)
  const thr = speechThresholdLinear(floor)

  const prevEnd = n.prevEndMs ?? n.wordStartMs - 200
  const nextStart = n.nextStartMs ?? n.wordEndMs + 200

  const leftSearchLo = Math.max(prevEnd - 20, n.wordStartMs - 200)
  const leftSearchHi = Math.min(n.wordStartMs + 60, n.wordEndMs)
  const rightSearchLo = Math.max(n.wordEndMs - 60, n.wordStartMs)
  const rightSearchHi = Math.min(nextStart + 20, n.wordEndMs + 200)

  let left = lowestValleyMs(frames, leftSearchLo, leftSearchHi, thr)
  let right = lowestValleyMs(frames, rightSearchLo, rightSearchHi, thr)

  let confidence: CutConfidence = 'ready'
  let note = reason

  if (left == null) {
    left = n.wordStartMs
    confidence = 'needs_review'
    note = `${reason}; no quiet valley on left`
  } else if (left > n.wordStartMs + NEIGHBOR_INTRUSION_MS) {
    confidence = 'needs_review'
    note = `${reason}; left edge inside neighbor word`
  }

  if (right == null) {
    right = n.wordEndMs
    confidence = 'needs_review'
    note = `${note}; no quiet valley on right`
  } else if (right < n.wordEndMs - NEIGHBOR_INTRUSION_MS) {
    confidence = 'needs_review'
    note = `${note}; right edge inside neighbor word`
  }

  left = snapZeroCrossing(frames, left)
  right = snapZeroCrossing(frames, right)
  if (n.prevEndMs != null) left = applyRoomTonePad(left, n.prevEndMs, true)
  if (n.nextStartMs != null) right = applyRoomTonePad(right, n.nextStartMs, false)

  left = Math.max(left, Math.min(n.wordStartMs, n.wordEndMs))
  right = Math.min(right, Math.max(n.wordStartMs, n.wordEndMs))
  if (right - left < 20) {
    left = n.wordStartMs
    right = n.wordEndMs
    confidence = 'needs_review'
    note = `${note}; range too narrow after refine`
  }

  return {
    range: [Math.round(left), Math.round(right)],
    meta: {
      srcStartMs: Math.round(left),
      srcEndMs: Math.round(right),
      confidence,
      reason: note,
    },
  }
}

/** Synthetic tone burst for unit tests (§6). */
export function syntheticFillerAudio(opts: {
  prevEndMs: number
  fillerStartMs: number
  fillerEndMs: number
  nextStartMs: number
  fillerTouchesNext?: boolean
}): RmsFrame[] {
  const frames: RmsFrame[] = []
  const push = (t: number, rms: number) => frames.push({ tMs: t, rms })
  for (let t = opts.prevEndMs - 100; t <= opts.nextStartMs + 100; t += HOP_MS) {
    let rms = 0.02
    if (t >= opts.fillerStartMs && t <= opts.fillerEndMs) rms = 0.35
    if (t >= opts.prevEndMs - 30 && t <= opts.prevEndMs + 40) rms = 0.4
    if (t >= opts.nextStartMs - 40 && t <= opts.nextStartMs + 30) rms = 0.45
    if (opts.fillerTouchesNext && t >= opts.fillerEndMs - 20 && t <= opts.nextStartMs + 20) rms = 0.38
    push(t, rms)
  }
  return framesFromSamples(frames)
}
