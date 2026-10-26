/** Pure helpers for near-live VOD chunk windows (unit-tested). */

export const NEAR_LIVE_DEFAULT_POLL_MIN = 12
export const NEAR_LIVE_MIN_CHUNK_MS = 8 * 60_000
export const NEAR_LIVE_MAX_CHUNK_MS = 20 * 60_000

export type NearLiveChunkPlan = {
  startMs: number
  endMs: number
  nextWatermarkMs: number
}

/** Plan the next downloadable window from archive duration and last processed watermark. */
export function planNearLiveChunk(
  archiveDurationMs: number,
  processedEndMs: number,
  opts?: { minChunkMs?: number; maxChunkMs?: number },
): NearLiveChunkPlan | null {
  const minChunk = opts?.minChunkMs ?? NEAR_LIVE_MIN_CHUNK_MS
  const maxChunk = opts?.maxChunkMs ?? NEAR_LIVE_MAX_CHUNK_MS
  const startMs = Math.max(0, processedEndMs)
  if (archiveDurationMs <= startMs) return null
  const available = archiveDurationMs - startMs
  if (available < minChunk) return null
  const chunk = Math.min(maxChunk, available)
  const endMs = startMs + chunk
  return { startMs, endMs, nextWatermarkMs: endMs }
}

export function nearLivePollDelayMs(pollMin = NEAR_LIVE_DEFAULT_POLL_MIN): number {
  return pollMin * 60_000
}
