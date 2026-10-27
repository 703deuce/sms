import { afterEach, describe, expect, it, vi } from 'vitest'

describe('getLiveKitServerEnv', () => {
  afterEach(async () => {
    delete process.env.LIVEKIT_URL
    delete process.env.LIVEKIT_API_KEY
    delete process.env.LIVEKIT_API_SECRET
    const { resetLiveKitEnvCache } = await import('@/lib/server/livekit/env')
    resetLiveKitEnvCache()
    vi.resetModules()
  })

  it('fails with a clear message when LIVEKIT_* are missing', async () => {
    const { getLiveKitServerEnv } = await import('@/lib/server/livekit/env')
    expect(() => getLiveKitServerEnv()).toThrow(/Recording LiveKit/)
    expect(() => getLiveKitServerEnv()).toThrow(/LIVEKIT_URL/)
  })

  it('accepts valid wss env', async () => {
    process.env.LIVEKIT_URL = 'wss://proj.livekit.cloud'
    process.env.LIVEKIT_API_KEY = 'APIkey'
    process.env.LIVEKIT_API_SECRET = 'secret'
    const { getLiveKitServerEnv } = await import('@/lib/server/livekit/env')
    expect(getLiveKitServerEnv().LIVEKIT_API_KEY).toBe('APIkey')
  })
})
