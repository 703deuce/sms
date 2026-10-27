import { describe, expect, it } from 'vitest'
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
})
