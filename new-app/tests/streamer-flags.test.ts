import { afterEach, describe, expect, it } from 'vitest'
import { streamerLiveRealtimeEnabled, streamerPublicFlags } from '@/lib/server/streamer/env'

describe('streamerLiveRealtimeEnabled', () => {
  afterEach(() => {
    delete process.env.STREAMER_LIVE_REALTIME_ENABLED
  })

  it('is off by default', () => {
    expect(streamerLiveRealtimeEnabled()).toBe(false)
    expect(streamerPublicFlags().liveRealtimeEnabled).toBe(false)
  })

  it('enables only for explicit truthy env', () => {
    process.env.STREAMER_LIVE_REALTIME_ENABLED = 'true'
    expect(streamerLiveRealtimeEnabled()).toBe(true)
  })
})
