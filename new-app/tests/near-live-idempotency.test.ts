import { describe, expect, it } from 'vitest'
import {
  clipIngestPayloadMatches,
  hasClipIngestForId,
  shouldSkipNearLiveChunkImport,
} from '@/lib/server/streamer/near-live/idempotency'

describe('near-live idempotency', () => {
  it('matches clip ingest payloads', () => {
    expect(clipIngestPayloadMatches({ twitchClipId: 'abc' }, 'abc')).toBe(true)
    expect(clipIngestPayloadMatches({ twitchClipId: 'x' }, 'abc')).toBe(false)
  })

  it('detects duplicate ingest jobs', () => {
    expect(hasClipIngestForId([{ payload: { twitchClipId: 'c1' } }], 'c1')).toBe(true)
    expect(hasClipIngestForId([{ payload: { twitchClipId: 'c2' } }], 'c1')).toBe(false)
  })

  it('skips chunk import when import already active', () => {
    expect(shouldSkipNearLiveChunkImport(0)).toBe(false)
    expect(shouldSkipNearLiveChunkImport(1)).toBe(true)
  })
})
