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

  it('ensureKickEventSubscriptions creates only missing events', async () => {
    process.env.KICK_CLIENT_ID = 'test-client'
    process.env.KICK_CLIENT_SECRET = 'test-secret'
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('oauth/token')) {
          return { ok: true, json: async () => ({ access_token: 'app-token' }) }
        }
        if (url.includes('subscriptions?broadcaster_user_id')) {
          return {
            ok: true,
            json: async () => ({
              data: [
                {
                  subscription_id: 'sub_1',
                  name: 'livestream.status.updated',
                  broadcaster_user_id: 42,
                },
              ],
            }),
          }
        }
        if (init?.method === 'POST') {
          calls.push(String(init.body))
          return {
            ok: true,
            json: async () => ({
              data: [{ subscription_id: 'sub_new', name: 'chat.message.sent' }],
            }),
          }
        }
        return { ok: false, status: 404, text: async () => '' }
      }),
    )
    const { ensureKickEventSubscriptions } = await import('@/lib/server/streamer/kick')
    const ids = await ensureKickEventSubscriptions(42, ['sub_1'])
    expect(ids).toContain('sub_1')
    expect(calls.length).toBe(1)
    expect(calls[0]).toContain('chat.message.sent')
    vi.unstubAllGlobals()
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
