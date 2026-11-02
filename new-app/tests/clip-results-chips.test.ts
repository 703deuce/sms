import { describe, expect, it } from 'vitest'
import { clipDisplayTitle, clipFallbackPickLabel, clipIsFallbackPick, isInternalClipReasoningText } from '@/lib/clips/clip-results-chips'

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

describe('clip display title sanitization', () => {
  it('hides pass-1 segment planning notes from card titles', () => {
    const leaked =
      's32 introduces the Michigan Senate race, and s33-s38 build a compelling arc about the primary'
    expect(isInternalClipReasoningText(leaked)).toBe(true)
    expect(clipDisplayTitle({ title: leaked, aiMeta: { hook: 'Michigan Senate race heats up' } })).toBe(
      'Michigan Senate race heats up',
    )
  })
})
