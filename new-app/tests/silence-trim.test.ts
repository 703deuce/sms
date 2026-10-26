import { describe, expect, it } from 'vitest'
import { silenceTrimCutRanges } from '@/lib/clips/silence-trim'

describe('silenceTrimCutRanges', () => {
  it('reduces 1.2s gaps to 0.15s keep', () => {
    const words = [
      { s: 0, e: 1 },
      { s: 2.2, e: 3 },
      { s: 4.4, e: 5 },
      { s: 6.6, e: 7 },
    ]
    const cuts = silenceTrimCutRanges(words, { enabled: true, minGapMs: 600, keepMs: 150 })
    expect(cuts.length).toBe(3)
    const totalRemoved = cuts.reduce((a, [s, e]) => a + (e - s), 0)
    expect(totalRemoved).toBeGreaterThan(2500)
  })
})
