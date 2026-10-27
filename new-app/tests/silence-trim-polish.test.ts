import { describe, expect, it } from 'vitest'
import {
  fillerWordCutRanges,
  silenceTrimCutRanges,
  SILENCE_TRIM_NATURAL,
} from '@/lib/clips/silence-trim'

describe('silence trim polish', () => {
  it('cuts gaps over 350ms down toward 120ms keep', () => {
    const cuts = silenceTrimCutRanges(
      [{ s: 0, e: 1 }, { s: 2, e: 2.5 }],
      SILENCE_TRIM_NATURAL,
    )
    expect(cuts.length).toBe(1)
    const [a, b] = cuts[0]
    expect(b - a).toBeGreaterThan(500)
  })

  it('cuts isolated um tokens', () => {
    const cuts = fillerWordCutRanges([{ s: 1, e: 1.3, w: 'um' }])
    expect(cuts).toEqual([[1000, 1300]])
  })
})
