import { describe, expect, it } from 'vitest'
import { clampTrimToExtendedBounds, expandedSourceCutMs } from '@/lib/clips/trim-bounds'

describe('trim-bounds', () => {
  it('allows trim 8s beyond AI clip window', () => {
    const trim = clampTrimToExtendedBounds(10_000, 20_000, { in: 3000, out: 27_000 })
    expect(trim.in).toBe(3000)
    expect(trim.out).toBe(27_000)
    const cut = expandedSourceCutMs(10_000, 20_000, { trim })
    expect(cut.cutStartMs).toBe(3000)
    expect(cut.cutEndMs).toBe(27_000)
  })

  it('clamps beyond extend cap', () => {
    const trim = clampTrimToExtendedBounds(10_000, 20_000, { in: 0, out: 100_000 })
    expect(trim.in).toBe(2000)
    expect(trim.out).toBe(28_000)
  })
})
