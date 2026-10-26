/** Pure helpers for near-live job idempotency (unit-tested). */

export type ClipIngestPayload = { twitchClipId?: string; projectId?: string; channelId?: string }

export function clipIngestPayloadMatches(payload: unknown, twitchClipId: string): boolean {
  if (!payload || typeof payload !== 'object') return false
  return (payload as ClipIngestPayload).twitchClipId === twitchClipId
}

export function hasClipIngestForId(jobs: { payload: unknown }[], twitchClipId: string): boolean {
  return jobs.some((j) => clipIngestPayloadMatches(j.payload, twitchClipId))
}

/** Skip enqueueing a new chunk import while one is already in flight. */
export function shouldSkipNearLiveChunkImport(activeImportCount: number): boolean {
  return activeImportCount > 0
}
