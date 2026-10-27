import { afterEach, describe, expect, it } from 'vitest'
import { streamerAutopullUiEnabled } from '@/lib/server/streamer/autopull-ui'
import { streamerLiveRealtimeEnabled, streamerPublicFlags } from '@/lib/server/streamer/env'

describe('streamerAutopullUiEnabled', () => {
  afterEach(() => {
    delete process.env.STREAMER_AUTOPULL_ENABLED
  })

  it('is off by default until ops enables', () => {
    expect(streamerAutopullUiEnabled()).toBe(false)
    expect(streamerPublicFlags().autopullUiEnabled).toBe(false)
  })

  it('enables only for explicit truthy env', () => {
    process.env.STREAMER_AUTOPULL_ENABLED = 'true'
    expect(streamerAutopullUiEnabled()).toBe(true)
  })
})

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
