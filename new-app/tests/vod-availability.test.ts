import { describe, expect, it } from 'vitest'
import {
  buildVodAvailabilityView,
  twitchCreatorStreamSettingsUrl,
  vodAvailabilityMessage,
} from '@/lib/streamer/vod-availability'

describe('vod-availability', () => {
  it('builds Twitch dashboard link for store past broadcasts', () => {
    expect(twitchCreatorStreamSettingsUrl('Ninja')).toBe(
      'https://dashboard.twitch.tv/u/ninja/settings/stream',
    )
  })

  it('maps store_past_broadcasts_off to blocked + fix steps', () => {
    const view = buildVodAvailabilityView('twitch', 'store_past_broadcasts_off', 'ninja')
    expect(view.status).toBe('blocked')
    expect(view.dashboardUrl).toContain('/settings/stream')
    expect(view.fixSteps?.length).toBeGreaterThan(0)
  })

  it('sub-only message', () => {
    const m = vodAvailabilityMessage('vod_sub_only')
    expect(m.status).toBe('blocked')
    expect(m.message).toMatch(/subscriber-only/i)
  })
})
