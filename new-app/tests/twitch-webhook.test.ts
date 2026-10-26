import { describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import { verifyTwitchEventSubSignature } from '@/lib/server/streamer/twitch-webhook'

describe('twitch eventsub verify', () => {
  it('accepts valid signature', () => {
    process.env.TWITCH_EVENTSUB_SECRET = 'testsecret123456'
    const body = '{"subscription":{"type":"stream.offline"}}'
    const id = 'msg-1'
    const ts = String(Math.floor(Date.now() / 1000))
    const sig =
      'sha256=' + createHmac('sha256', 'testsecret123456').update(id + ts + body).digest('hex')
    const headers = new Headers({
      'Twitch-Eventsub-Message-Id': id,
      'Twitch-Eventsub-Message-Timestamp': ts,
      'Twitch-Eventsub-Message-Signature': sig,
      'Twitch-Eventsub-Message-Type': 'notification',
    })
    const res = verifyTwitchEventSubSignature(body, headers)
    expect(res.ok).toBe(true)
  })

  it('rejects bad signature', () => {
    process.env.TWITCH_EVENTSUB_SECRET = 'testsecret123456'
    const headers = new Headers({
      'Twitch-Eventsub-Message-Id': 'x',
      'Twitch-Eventsub-Message-Timestamp': String(Math.floor(Date.now() / 1000)),
      'Twitch-Eventsub-Message-Signature': 'sha256=deadbeef',
      'Twitch-Eventsub-Message-Type': 'notification',
    })
    expect(verifyTwitchEventSubSignature('{}', headers).ok).toBe(false)
  })
})
