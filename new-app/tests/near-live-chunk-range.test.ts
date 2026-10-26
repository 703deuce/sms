import { describe, expect, it } from 'vitest'
import { planNearLiveChunk } from '@/lib/server/streamer/near-live/chunk-range'

describe('near-live chunk range', () => {
  it('returns null until min chunk available', () => {
    expect(planNearLiveChunk(5 * 60_000, 0)).toBeNull()
  })

  it('plans next window from watermark', () => {
    const p = planNearLiveChunk(30 * 60_000, 10 * 60_000)
    expect(p).toEqual({ startMs: 600_000, endMs: 1_280_000, nextWatermarkMs: 1_280_000 })
  })
})
