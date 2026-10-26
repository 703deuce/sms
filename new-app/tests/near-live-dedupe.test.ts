import { describe, expect, it } from 'vitest'
import { dedupeClipsByTime } from '@/lib/server/streamer/near-live/dedupe'
import { nearLiveSessionIsActive } from '@/lib/server/streamer/near-live/session'
import { planNearLiveChunk } from '@/lib/server/streamer/near-live/chunk-range'
import { twitchConnectionHasClipsEdit } from '@/lib/server/streamer/twitch'

describe('near-live dedupe', () => {
  it('removes lower-score overlapping clips', () => {
    const { kept, removedIds } = dedupeClipsByTime([
      { id: 'a', startMs: 0, endMs: 30_000, score: 90 },
      { id: 'b', startMs: 5_000, endMs: 35_000, score: 70 },
      { id: 'c', startMs: 60_000, endMs: 90_000, score: 80 },
    ])
    expect(kept.map((k) => k.id)).toEqual(['a', 'c'])
    expect(removedIds).toEqual(['b'])
  })
})

describe('near-live idempotency helpers', () => {
  it('detects active session', () => {
    expect(nearLiveSessionIsActive({ projectId: 'p', vodId: 'v', processedEndMs: 0, streamStartedAt: '' })).toBe(true)
    expect(nearLiveSessionIsActive({ projectId: 'p', vodId: 'v', processedEndMs: 0, streamStartedAt: '', finalized: true })).toBe(
      false,
    )
  })

  it('does not plan chunk when watermark caught up', () => {
    expect(planNearLiveChunk(600_000, 600_000)).toBeNull()
  })

  it('detects clips:edit scope', () => {
    expect(twitchConnectionHasClipsEdit({ scopes: ['clips:edit'] })).toBe(true)
    expect(twitchConnectionHasClipsEdit({ scopes: ['user:read:chat'] })).toBe(false)
  })
})
