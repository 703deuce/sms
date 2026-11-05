import { describe, expect, it } from 'vitest'
import { defaultEdits } from '@/lib/clips/edits'
import {
  fillerWordCutRanges,
  silenceTrimCutRanges,
  applySilenceTrimToEdits,
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

  it('never removes mhm/hmm acknowledgements as disposable filler', () => {
    const cuts = fillerWordCutRanges([
      { s: 0, e: 0.2, w: 'mhm' }, { s: 0.3, e: 0.5, w: 'hmm' },
      { s: 0.6, e: 0.8, w: 'mm' }, { s: 0.9, e: 1.1, w: 'um' },
    ])
    expect(cuts).toEqual([[900, 1100]])
  })

  it('skips tightly connected fillers without audio to avoid clipping retained words', () => {
    const cuts = fillerWordCutRanges([
      { s: 0.4, e: 0.9, w: 'before' },
      { s: 0.92, e: 1.15, w: 'um' },
      { s: 1.16, e: 1.5, w: 'after' },
    ])
    expect(cuts).toEqual([])
  })

  it('preserves an exact filler cut through the silence-trim sanitizer', () => {
    const edits = defaultEdits({ clipStartMs: 0, clipEndMs: 3000 })
    const polished = applySilenceTrimToEdits(edits,
      [{ s: 1.0, e: 1.3, w: 'um' }, { s: 1.6, e: 2.0, w: 'hello' }],
      { enabled: true, minGapMs: 350, keepMs: 120, fillerTrim: true })
    expect(polished.cutRanges).toContainEqual([1000, 1300])
    expect(polished.cutRanges.some(([a,b]) => a <= 1600 && b > 1600)).toBe(false)
  })

  it('cuts isolated um tokens', () => {
    const cuts = fillerWordCutRanges([{ s: 1, e: 1.3, w: 'um' }])
    expect(cuts).toEqual([[1000, 1300]])
  })
})
