import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/server/t2v/stock-match', () => ({ searchT2vStock: vi.fn() }))
vi.mock('@/lib/server/ai/pexels', () => ({ pexelsConfigured: () => false }))
vi.mock('@/lib/server/t2v/log', () => ({ logT2v: vi.fn() }))

import { queryWords, tagOverlap } from '@/lib/server/t2v/pipeline/t2v-footage-agent'

describe('prompt-to-video footage ranking', () => {
  it('drops stop words', () => {
    expect(queryWords('car pulls into the driveway')).toEqual(['car', 'pulls', 'driveway'])
  })
  it('counts query words present in tags (stems + EV aliases)', () => {
    const ev = ['charging plug', 'e auto', 'electric car', 'charging station']
    expect(tagOverlap(queryWords('electric car charging'), ev)).toBe(3)
    expect(tagOverlap(queryWords('ev charger'), ev)).toBe(2)
    expect(tagOverlap(queryWords('electric car charging'), ['beef', 'patty', 'hamburger', 'grill'])).toBe(0)
  })
})
