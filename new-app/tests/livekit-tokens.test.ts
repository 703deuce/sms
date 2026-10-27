import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetLiveKitEnvCache } from '@/lib/server/livekit/env'

const toJwt = vi.fn(async () => 'jwt-test')
const accessTokenCtor = vi.fn()

vi.mock('livekit-server-sdk', () => {
  class AccessToken {
    constructor(apiKey: string, apiSecret: string) {
      accessTokenCtor(apiKey, apiSecret)
    }
    addGrant() {}
    toJwt = toJwt
  }
  return {
    AccessToken,
    TrackSource: {
      CAMERA: 'camera',
      MICROPHONE: 'microphone',
      SCREEN_SHARE: 'screen_share',
      SCREEN_SHARE_AUDIO: 'screen_share_audio',
    },
  }
})

describe('mintJoinToken', () => {
  afterEach(() => {
    delete process.env.LIVEKIT_URL
    delete process.env.LIVEKIT_API_KEY
    delete process.env.LIVEKIT_API_SECRET
    delete process.env.LIVEKIT_SELF_HOSTED_URL
    resetLiveKitEnvCache()
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('uses only cloud LIVEKIT_* credentials', async () => {
    process.env.LIVEKIT_URL = 'wss://sms-6w01zoya.livekit.cloud'
    process.env.LIVEKIT_API_KEY = 'cloud-key'
    process.env.LIVEKIT_API_SECRET = 'cloud-secret'
    process.env.LIVEKIT_SELF_HOSTED_URL = 'wss://voice.transovo.ai'
    process.env.LIVEKIT_SELF_HOSTED_API_KEY = 'wrong'
    const { mintJoinToken } = await import('@/lib/server/livekit/tokens')
    const jwt = await mintJoinToken({
      roomName: 'rec_test',
      identity: 'recp_1',
      displayName: 'Host',
      role: 'host',
      sessionId: 'recs_1',
    })
    expect(jwt).toBe('jwt-test')
    expect(toJwt).toHaveBeenCalled()
    expect(accessTokenCtor).toHaveBeenCalledWith('cloud-key', 'cloud-secret')
  })
})
