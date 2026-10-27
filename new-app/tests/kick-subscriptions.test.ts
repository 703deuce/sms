import { describe, expect, it, vi } from 'vitest'
import { kickSubscriptionsDue, parseKickSubscriptionCreateRows } from '@/lib/server/streamer/kick'

describe('kick subscriptions', () => {
  it('parses subscription_id and skips per-event errors', () => {
    const ids = parseKickSubscriptionCreateRows({
      data: [
        { subscription_id: 'sub_1', name: 'livestream.status.updated' },
        { error: 'already exists', name: 'chat.message.sent' },
        { id: 'legacy', name: 'livestream.metadata.updated' },
      ],
    })
    expect(ids).toEqual(['sub_1', 'legacy'])
  })

  it('subscription check is due hourly', () => {
    const hourAgo = new Date(Date.now() - 3601_000).toISOString()
    expect(kickSubscriptionsDue(hourAgo)).toBe(true)
    expect(kickSubscriptionsDue(new Date().toISOString())).toBe(false)
  })

  it('listKickEventSubscriptions throws when list HTTP fails', async () => {
    process.env.KICK_CLIENT_ID = 'test-client'
    process.env.KICK_CLIENT_SECRET = 'test-secret'
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('oauth/token')) {
          return { ok: true, json: async () => ({ access_token: 'app-token' }) }
        }
        return { ok: false, status: 503, text: async () => 'unavailable' }
      }),
    )
    const { listKickEventSubscriptions } = await import('@/lib/server/streamer/kick')
    await expect(listKickEventSubscriptions(42)).rejects.toThrow(/list subscriptions failed/i)
    vi.unstubAllGlobals()
  })
})
