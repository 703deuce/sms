import { describe, expect, it } from 'vitest'
import { cleanPixabayQuery, mergeAutoBrollItems } from '@/lib/clips/broll-auto-utils'

describe('broll-auto-utils', () => {
  it('uses first clean query phrase', () => {
    expect(cleanPixabayQuery('comic book,reading a comic book,comic book pages')).toBe('comic book')
  })

  it('replaces auto stock and keeps manual', () => {
    const merged = mergeAutoBrollItems(
      [
        { id: '1', source: 'stock', assetId: 'a', startMs: 0, endMs: 1000, placement: 'auto' },
        { id: '2', source: 'stock', assetId: 'b', startMs: 2000, endMs: 3000, placement: 'manual' },
      ],
      [{ id: '3', source: 'stock', assetId: 'c', startMs: 5000, endMs: 6000, placement: 'auto' }],
    )
    expect(merged.map((b) => b.id)).toEqual(['2', '3'])
  })
})
