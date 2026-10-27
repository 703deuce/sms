/** Marathon session stitching (Twitch 48h splits, Kick reconnects). */

export const STREAM_SESSION_GAP_MAX_S = Number(process.env.STREAM_SESSION_GAP_MAX_S || 600)

export type StreamSegmentRef = {
  vodExternalId?: string | null
  url?: string | null
  streamedAt: string
  durationMs: number
}

export function gapSeconds(previousEndIso: string, nextStartIso: string): number | null {
  const a = Date.parse(previousEndIso)
  const b = Date.parse(nextStartIso)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return (b - a) / 1000
}

export function shouldMergeStreamSegments(
  previousEndIso: string,
  nextStartIso: string,
  gapMaxS = STREAM_SESSION_GAP_MAX_S,
): boolean {
  const g = gapSeconds(previousEndIso, nextStartIso)
  if (g === null) return false
  return g >= 0 && g <= gapMaxS
}

export function sessionEndFromSegment(streamedAtIso: string, durationMs: number): string {
  const start = Date.parse(streamedAtIso)
  return new Date(start + durationMs).toISOString()
}
