import { describe, expect, it } from 'vitest'
import { matchTwitchArchiveVod } from '@/lib/server/streamer/twitch-growing'

describe('matchTwitchArchiveVod', () => {
  it('returns null when Helix fails', async () => {
    const orig = global.fetch
    global.fetch = async () => new Response('nope', { status: 500 })
    await expect(matchTwitchArchiveVod('1', new Date())).resolves.toBeNull()
    global.fetch = orig
  })
})
