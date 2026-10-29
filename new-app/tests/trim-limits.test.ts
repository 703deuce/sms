import { describe, expect, it } from 'vitest'
import { clipTrimLimits } from '@/lib/clips/clip-trim-limits'
import { clampTrimToExtendedBounds } from '@/lib/clips/trim-bounds'

describe('clipTrimLimits', () => {
  it('uses source segment bounds when present', () => {
    const limits = clipTrimLimits(
      {
        startMs: 10_000,
        endMs: 20_000,
        sourceSegKey: 'seg',
        sourceSegStartMs: 5000,
        sourceSegEndMs: 25_000,
      },
      60_000,
      true,
    )
    expect(limits).toEqual({ trimMinMs: 5000, trimMaxMs: 25_000 })
  })

  it('clamps trim to media bounds passed through normalize path', () => {
    const trim = clampTrimToExtendedBounds(
      10_000,
      20_000,
      { in: 1000, out: 30_000 },
      { minMs: 5000, maxMs: 25_000 },
    )
    expect(trim.in).toBe(5000)
    expect(trim.out).toBe(25_000)
  })
})
