import { describe, expect, it } from 'vitest'
import { clampHashtagsForPlatform } from '@/lib/clips/post-copy-hashtags'

describe('clampHashtagsForPlatform', () => {
  it('limits Instagram to 5', () => {
    const tags = Array.from({ length: 12 }, (_, i) => `tag${i}`)
    expect(clampHashtagsForPlatform('instagram_reels', tags)).toHaveLength(5)
  })

  it('limits Shorts to 3', () => {
    expect(clampHashtagsForPlatform('youtube_shorts', ['a', 'b', 'c', 'd'])).toEqual(['a', 'b', 'c'])
  })

  it('limits TikTok to 5', () => {
    expect(clampHashtagsForPlatform('tiktok', ['a', 'b', 'c', 'd', 'e', 'f'])).toHaveLength(5)
  })
})
