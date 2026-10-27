import { describe, expect, it } from 'vitest'
import { clipFallbackPickLabel, clipIsFallbackPick } from '@/lib/clips/clip-results-chips'

describe('clip-results-chips fallback', () => {
  it('detects low_confidence and emergency reason', () => {
    expect(clipIsFallbackPick({ low_confidence: true }, null)).toBe(true)
    expect(clipIsFallbackPick({}, 'short_source_emergency')).toBe(true)
    expect(clipFallbackPickLabel({}, 'short_source_emergency')).toBe('Fallback pick')
  })

  it('ignores normal picks', () => {
    expect(clipIsFallbackPick({}, 'Strong hook on pricing')).toBe(false)
  })
})
