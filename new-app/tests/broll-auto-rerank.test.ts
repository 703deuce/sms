import { describe, expect, it } from 'vitest'
import { filterAndRankPixabayHits, tagKeywordOverlapScore } from '@/lib/clips/pixabay-rerank'

describe('pixabay auto b-roll rerank', () => {
  it('drops ostrich hit for comic books query', () => {
    const hits = [
      { providerId: '1', tags: 'ostrich, bird, nature', durationS: 10 },
      { providerId: '2', tags: 'comic, books, reading, stack', durationS: 12 },
    ]
    const ranked = filterAndRankPixabayHits(hits, 'comic books stack', ['comic', 'books'])
    expect(ranked.map((h) => h.providerId)).toEqual(['2'])
    expect(tagKeywordOverlapScore('ostrich, bird', 'comic books', ['comic'])).toBe(0)
  })

  it('prefers higher tag overlap', () => {
    const hits = [
      { providerId: 'a', tags: 'reading, book', durationS: 8 },
      { providerId: 'b', tags: 'comic, books, marvel', durationS: 8 },
    ]
    const ranked = filterAndRankPixabayHits(hits, 'comic books', ['comic'])
    expect(ranked[0]?.providerId).toBe('b')
  })
})
