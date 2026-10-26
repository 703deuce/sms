import { describe, expect, it } from 'vitest'
import { EMOJI_WHITELIST, EMOJI_WHITELIST_SET } from '@/lib/clips/emoji-whitelist'

describe('emoji whitelist', () => {
  it('has at least 100 entries and filters unknown', () => {
    expect(EMOJI_WHITELIST.length).toBeGreaterThanOrEqual(100)
    expect(EMOJI_WHITELIST_SET.has('🔥')).toBe(true)
    expect(EMOJI_WHITELIST_SET.has('🦄')).toBe(false)
  })
})
