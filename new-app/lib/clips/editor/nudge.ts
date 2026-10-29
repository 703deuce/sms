import { clampTrimToExtendedBounds } from '@/lib/clips/trim-bounds'

export type TrimNudgeLimits = {
  clipStartMs: number
  clipEndMs: number
  trimMinMs?: number
  trimMaxMs?: number
}

export function trimLimitPair(limits: TrimNudgeLimits): { minMs?: number; maxMs?: number } | undefined {
  if (limits.trimMinMs != null && limits.trimMaxMs != null) {
    return { minMs: limits.trimMinMs, maxMs: limits.trimMaxMs }
  }
  return undefined
}

export function nudgeTrimIn(
  trim: { in: number; out: number },
  deltaMs: number,
  limits: TrimNudgeLimits,
): { in: number; out: number } {
  const media = trimLimitPair(limits)
  const nextIn = trim.in + deltaMs
  return clampTrimToExtendedBounds(
    limits.clipStartMs,
    limits.clipEndMs,
    { in: nextIn, out: trim.out },
    media,
  )
}

export function nudgeTrimOut(
  trim: { in: number; out: number },
  deltaMs: number,
  limits: TrimNudgeLimits,
): { in: number; out: number } {
  const media = trimLimitPair(limits)
  const nextOut = trim.out + deltaMs
  return clampTrimToExtendedBounds(
    limits.clipStartMs,
    limits.clipEndMs,
    { in: trim.in, out: nextOut },
    media,
  )
}
