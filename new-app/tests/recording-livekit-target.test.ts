import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetLiveKitEnvCache } from '@/lib/server/livekit/env'

describe('recording room service (LiveKit Cloud only)', () => {
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

  it('reads only LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET', async () => {
    process.env.LIVEKIT_URL = 'wss://sms-6w01zoya.livekit.cloud'
    process.env.LIVEKIT_API_KEY = 'cloud-key'
    process.env.LIVEKIT_API_SECRET = 'cloud-secret'
    const { resolveRecordingLiveKitEnv, recordingLiveKitCloudEnvKeys } = await import(
      '@/lib/server/livekit/recording-room-service'
    )
    expect(recordingLiveKitCloudEnvKeys()).toEqual([
      'LIVEKIT_URL',
      'LIVEKIT_API_KEY',
      'LIVEKIT_API_SECRET',
    ])
    const env = resolveRecordingLiveKitEnv()
    expect(env.LIVEKIT_URL).toBe('wss://sms-6w01zoya.livekit.cloud')
    expect(env.LIVEKIT_API_KEY).toBe('cloud-key')
    expect(env.LIVEKIT_API_SECRET).toBe('cloud-secret')
  })

  it('ignores self-hosted vars and RECORDING_LIVEKIT_TARGET when cloud vars are set', async () => {
    process.env.LIVEKIT_URL = 'wss://sms-6w01zoya.livekit.cloud'
    process.env.LIVEKIT_API_KEY = 'cloud-key'
    process.env.LIVEKIT_API_SECRET = 'cloud-secret'
    process.env.RECORDING_LIVEKIT_TARGET = 'self_hosted'
    process.env.LIVEKIT_SELF_HOSTED_URL = 'wss://voice.transovo.ai'
    process.env.LIVEKIT_SELF_HOSTED_API_KEY = 'self-key'
    process.env.LIVEKIT_SELF_HOSTED_API_SECRET = 'self-secret'
    const { resolveRecordingLiveKitEnv } = await import('@/lib/server/livekit/recording-room-service')
    const env = resolveRecordingLiveKitEnv()
    expect(env.LIVEKIT_URL).toBe('wss://sms-6w01zoya.livekit.cloud')
    expect(env.LIVEKIT_API_KEY).toBe('cloud-key')
    expect(env.LIVEKIT_API_SECRET).toBe('cloud-secret')
  })

  it('getLiveKitServerEnv uses the same cloud triple', async () => {
    process.env.LIVEKIT_URL = 'wss://sms-6w01zoya.livekit.cloud'
    process.env.LIVEKIT_API_KEY = 'k'
    process.env.LIVEKIT_API_SECRET = 's'
    const { getLiveKitServerEnv, getLiveKitPublicUrl } = await import('@/lib/server/livekit/env')
    expect(getLiveKitServerEnv().LIVEKIT_API_KEY).toBe('k')
    expect(getLiveKitPublicUrl()).toBe('wss://sms-6w01zoya.livekit.cloud')
  })
})
