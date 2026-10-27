import { afterEach, describe, expect, it } from 'vitest'

describe('feature-gates', () => {
  afterEach(() => {
    delete process.env.LIVEKIT_URL
    delete process.env.LIVEKIT_API_KEY
    delete process.env.LIVEKIT_API_SECRET
    delete process.env.FEATURE_SCRIPT_RECORDING
    vi.resetModules()
  })

  it('isLiveKitConfigured is false without env', async () => {
    const { isLiveKitConfigured, isRecordingFeatureEnabled } = await import('@/lib/server/clips/feature-gates')
    expect(isLiveKitConfigured()).toBe(false)
    expect(isRecordingFeatureEnabled()).toBe(false)
  })

  it('isRecordingFeatureEnabled respects FEATURE_SCRIPT_RECORDING=0', async () => {
    process.env.LIVEKIT_URL = 'wss://x.livekit.cloud'
    process.env.LIVEKIT_API_KEY = 'k'
    process.env.LIVEKIT_API_SECRET = 's'
    process.env.FEATURE_SCRIPT_RECORDING = '0'
    const { isRecordingFeatureEnabled } = await import('@/lib/server/clips/feature-gates')
    expect(isRecordingFeatureEnabled()).toBe(false)
  })
})
