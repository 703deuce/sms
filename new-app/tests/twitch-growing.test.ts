import { describe, expect, it } from 'vitest'
import { matchTwitchArchiveVod } from '@/lib/server/streamer/twitch-growing'

describe('matchTwitchArchiveVod', () => {
  it('returns null when Helix fails', async () => {
    process.env.TWITCH_CLIENT_ID = 'test-client'
    process.env.TWITCH_CLIENT_SECRET = 'test-secret'
    const orig = global.fetch
    global.fetch = async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 })
      }
      return new Response('nope', { status: 500 })
    }
    await expect(matchTwitchArchiveVod('1', new Date())).resolves.toBeNull()
    global.fetch = orig
  })
})
