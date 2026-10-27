import { describe, expect, it } from 'vitest'
import { assertLiveKitWsUrl } from '@/lib/recording/livekit-connect'

describe('assertLiveKitWsUrl', () => {
  it('accepts wss cloud URLs', () => {
    expect(assertLiveKitWsUrl('wss://sms-6w01zoya.livekit.cloud')).toContain('wss://')
  })

  it('rejects https API URLs', () => {
    expect(() => assertLiveKitWsUrl('https://sms-6w01zoya.livekit.cloud')).toThrow(/WebSocket/)
  })

  it('rejects empty', () => {
    expect(() => assertLiveKitWsUrl('')).toThrow(/missing/)
  })
})
