import { describe, expect, it } from 'vitest'
import {
  cutIntersectsWordInterior,
  snapCutRangeToWordGaps,
  sanitizeCutRangesForWords,
} from '@/lib/clips/word-cut'

const words = [
  { s: 1.0, e: 1.4, w: 'hello' },
  { s: 1.5, e: 1.9, w: 'world' },
]

describe('word-cut', () => {
  it('rejects cuts through word midpoints', () => {
    expect(cutIntersectsWordInterior([1100, 1300], words)).toBe(true)
  })

  it('snaps gap cuts between words with pad', () => {
    const snapped = snapCutRangeToWordGaps([1405, 1495], words, 60)
    expect(snapped).not.toBeNull()
    if (snapped) {
      expect(cutIntersectsWordInterior(snapped, words)).toBe(false)
    }
  })

  it('sanitize drops invalid interior cuts', () => {
    const out = sanitizeCutRangesForWords([[1100, 1300]], words)
    expect(out.length).toBe(0)
  })
})
