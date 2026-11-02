import { describe, expect, it } from 'vitest'
import { formatMomentMs } from '@/lib/clips/format-moment-ms'

describe('formatMomentMs', () => {
  it('formats m:ss.s with one decimal', () => {
    expect(formatMomentMs(61700)).toBe('1:01.7')
    expect(formatMomentMs(7840)).toBe('0:07.8')
    expect(formatMomentMs(0)).toBe('0:00.0')
  })
})
