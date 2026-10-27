import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetLiveKitEnvCache } from '@/lib/server/livekit/env'

describe('recording LiveKit target', () => {
  afterEach(() => {
    delete process.env.RECORDING_LIVEKIT_TARGET
    delete process.env.LIVEKIT_URL
    delete process.env.LIVEKIT_API_KEY
    delete process.env.LIVEKIT_API_SECRET
    delete process.env.LIVEKIT_SELF_HOSTED_URL
    delete process.env.LIVEKIT_SELF_HOSTED_API_KEY
    delete process.env.LIVEKIT_SELF_HOSTED_API_SECRET
    resetLiveKitEnvCache()
    vi.resetModules()
  })

  it('defaults to cloud LIVEKIT_*', async () => {
    process.env.LIVEKIT_URL = 'wss://sms-6w01zoya.livekit.cloud'
    process.env.LIVEKIT_API_KEY = 'k'
    process.env.LIVEKIT_API_SECRET = 's'
    const { getRecordingLiveKitTarget, resolveRecordingLiveKitEnv } = await import(
      '@/lib/server/livekit/recording-room-service'
    )
    expect(getRecordingLiveKitTarget()).toBe('cloud')
    expect(resolveRecordingLiveKitEnv().LIVEKIT_URL).toBe('wss://sms-6w01zoya.livekit.cloud')
  })

  it('self_hosted uses LIVEKIT_SELF_HOSTED_* and normalizes https', async () => {
    process.env.RECORDING_LIVEKIT_TARGET = 'self_hosted'
    process.env.LIVEKIT_SELF_HOSTED_URL = 'https://voice.transovo.ai'
    process.env.LIVEKIT_SELF_HOSTED_API_KEY = 'k2'
    process.env.LIVEKIT_SELF_HOSTED_API_SECRET = 's2'
    const { resolveRecordingLiveKitEnv } = await import('@/lib/server/livekit/recording-room-service')
    const env = resolveRecordingLiveKitEnv()
    expect(env.LIVEKIT_URL).toBe('wss://voice.transovo.ai')
    expect(env.LIVEKIT_API_KEY).toBe('k2')
  })
})
