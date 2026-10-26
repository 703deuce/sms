import { describe, expect, it } from 'vitest'

import { STREAMER_DEFAULT_MONTHLY_HOURS, STREAMER_MAX_VOD_HOURS } from '@/lib/server/streamer/limits'

describe('streamer limits constants', () => {
  it('defaults match spec', () => {
    expect(STREAMER_DEFAULT_MONTHLY_HOURS).toBe(40)
    expect(STREAMER_MAX_VOD_HOURS).toBe(12)
  })
})
