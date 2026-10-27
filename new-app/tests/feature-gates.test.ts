import { afterEach, describe, expect, it, vi } from 'vitest'

describe('feature-gates', () => {
  afterEach(() => {
    delete process.env.LIVEKIT_URL
    delete process.env.LIVEKIT_API_KEY
    delete process.env.LIVEKIT_API_SECRET
    delete process.env.FEATURE_SCRIPT_RECORDING
    delete process.env.FEATURE_SOLO_RECORDING
    vi.resetModules()
  })

  it('isLiveKitConfigured is false without env', async () => {
    const { isLiveKitConfigured, isRecordingFeatureEnabled } = await import('@/lib/server/clips/feature-gates')
    expect(isLiveKitConfigured()).toBe(false)
    expect(isRecordingFeatureEnabled()).toBe(false)
  })

  it('isSoloEditorRecordingEnabled is true by default', async () => {
    const { isSoloEditorRecordingEnabled } = await import('@/lib/server/clips/feature-gates')
    expect(isSoloEditorRecordingEnabled()).toBe(true)
  })

  it('isSoloEditorRecordingEnabled respects FEATURE_SOLO_RECORDING=0', async () => {
    process.env.FEATURE_SOLO_RECORDING = '0'
    const { isSoloEditorRecordingEnabled } = await import('@/lib/server/clips/feature-gates')
    expect(isSoloEditorRecordingEnabled()).toBe(false)
  })

  it('isRecordingFeatureEnabled respects FEATURE_SCRIPT_RECORDING=0', async () => {
    process.env.LIVEKIT_URL = 'wss://x.livekit.cloud'
    process.env.LIVEKIT_API_KEY = 'k'
    process.env.LIVEKIT_API_SECRET = 's'
    process.env.FEATURE_SCRIPT_RECORDING = '0'
    const { isRecordingFeatureEnabled } = await import('@/lib/server/clips/feature-gates')
    expect(isRecordingFeatureEnabled()).toBe(false)
    const { isSoloEditorRecordingEnabled } = await import('@/lib/server/clips/feature-gates')
    expect(isSoloEditorRecordingEnabled()).toBe(false)
  })
})
