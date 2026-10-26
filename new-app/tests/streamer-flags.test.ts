import { afterEach, describe, expect, it } from 'vitest'
import {
  streamerLiveChatIngestEnabled,
  streamerLiveRealtimeEnabled,
  streamerNearLiveEnabled,
  streamerPublicFlags,
} from '@/lib/server/streamer/env'

describe('streamer env flags', () => {
  afterEach(() => {
    delete process.env.STREAMER_LIVE_REALTIME_ENABLED
    delete process.env.STREAMER_NEAR_LIVE_ENABLED
  })

  it('live realtime is off by default', () => {
    expect(streamerLiveRealtimeEnabled()).toBe(false)
    expect(streamerPublicFlags().liveRealtimeEnabled).toBe(false)
    expect(streamerNearLiveEnabled()).toBe(false)
  })

  it('near-live enables chat ingest without live realtime', () => {
    process.env.STREAMER_NEAR_LIVE_ENABLED = 'true'
    expect(streamerNearLiveEnabled()).toBe(true)
    expect(streamerLiveRealtimeEnabled()).toBe(false)
    expect(streamerLiveChatIngestEnabled()).toBe(true)
    expect(streamerPublicFlags().nearLiveEnabled).toBe(true)
  })

  it('live realtime enables only for explicit truthy env', () => {
    process.env.STREAMER_LIVE_REALTIME_ENABLED = 'true'
    expect(streamerLiveRealtimeEnabled()).toBe(true)
    expect(streamerLiveChatIngestEnabled()).toBe(true)
  })
})
