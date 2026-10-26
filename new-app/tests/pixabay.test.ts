import { describe, expect, it } from 'vitest'
import { filterAndRankPixabayHits } from '@/lib/clips/pixabay-rerank'
import { pickCacheRendition } from '@/lib/server/ai/pixabay'

describe('pixabay cache rendition', () => {
  it('prefers small when width >= 540 and never large', () => {
    const videos = {
      large: { url: 'https://large.mp4', width: 1920, height: 1080 },
      medium: { url: 'https://medium.mp4', width: 1280, height: 720 },
      small: { url: 'https://small.mp4', width: 640, height: 360 },
      tiny: { url: 'https://tiny.mp4', width: 320, height: 180 },
    }
    const picked = pickCacheRendition(videos)
    expect(picked?.url).toBe('https://small.mp4')
  })

  it('drops squirrel/peanut-only hits for newspaper comic strip query', () => {
    const hits = [
      { providerId: '1', tags: 'squirrel, peanut, animal, wildlife', durationS: 10 },
      { providerId: '2', tags: 'newspaper, comic, strip, reading, books', durationS: 12 },
    ]
    const ranked = filterAndRankPixabayHits(hits, 'newspaper comic strip', ['comic', 'newspaper'])
    expect(ranked.map((h) => h.providerId)).toEqual(['2'])
  })

  it('uses medium when small is too narrow', () => {
    const videos = {
      medium: { url: 'https://medium.mp4', width: 960, height: 540 },
      small: { url: 'https://small.mp4', width: 480, height: 270 },
      tiny: { url: 'https://tiny.mp4', width: 240, height: 135 },
    }
    const picked = pickCacheRendition(videos)
    expect(picked?.url).toBe('https://medium.mp4')
  })
})
