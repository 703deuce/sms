import { describe, expect, it } from 'vitest'
import { expandedSourceCutMs } from '@/lib/clips/trim-bounds'

describe('expandedSourceCutMs', () => {
  it('expands cut when trim exceeds AI clip window', () => {
    const { cutStartMs, cutEndMs } = expandedSourceCutMs(5000, 15000, {
      trim: { in: 1000, out: 20000 },
    })
    expect(cutStartMs).toBe(1000)
    expect(cutEndMs).toBe(20000)
  })
})
