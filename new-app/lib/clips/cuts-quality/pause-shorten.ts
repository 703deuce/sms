/**
 * CUTS_QUALITY1 §3: pause middle removal + motion guard.
 */
import type { CutRange } from '@/lib/clips/edits'

export const DEFAULT_MIN_GAP_SEC = 1.0
export const DEFAULT_LEAVE_SEC = 0.35
export const MIN_EDGE_MS = 120

export type GapMotionSample = { tMs: number; lumaDiff: number }

export function pauseMiddleRemovalRange(
  gapStartMs: number,
  gapEndMs: number,
  gapMs: number,
  leaveMs: number,
): CutRange | null {
  if (gapMs <= leaveMs + 50) return null
  const remove = gapMs - leaveMs
  if (remove <= 50) return null
  const edgeKeep = Math.max(MIN_EDGE_MS, Math.round(leaveMs / 2))
  const maxRemove = gapMs - edgeKeep * 2
  const take = Math.min(remove, maxRemove)
  if (take <= 40) return null
  const mid = gapStartMs + gapMs / 2
  let lo = Math.round(mid - take / 2)
  let hi = Math.round(mid + take / 2)
  lo = Math.max(gapStartMs + edgeKeep, lo)
  hi = Math.min(gapEndMs - edgeKeep, hi)
  if (hi - lo < 40) return null
  return [lo, hi]
}

/** Mean consecutive luma diff in gap; above threshold → on-screen action (§3). */
export function gapMotionScore(samples: GapMotionSample[]): number {
  if (samples.length < 2) return 0
  let sum = 0
  for (let i = 1; i < samples.length; i++) sum += samples[i]!.lumaDiff
  return sum / (samples.length - 1)
}

export const GAP_MOTION_KEEP_THRESHOLD = 8

export function gapKeptForMotion(samples: GapMotionSample[] | null | undefined): boolean {
  if (!samples?.length) return false
  return gapMotionScore(samples) > GAP_MOTION_KEEP_THRESHOLD
}
