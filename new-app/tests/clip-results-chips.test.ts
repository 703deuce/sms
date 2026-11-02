import { describe, expect, it } from 'vitest'
import {
  clipDisplayTitle,
  clipFallbackPickLabel,
  clipIsFallbackPick,
  clipScoreTooltipLines,
  clipTitleFromTranscriptWords,
  clipWhySummary,
  isGenericClipTitle,
  isInternalClipReasoningText,
  sanitizeClipDescriptionText,
} from '@/lib/clips/clip-results-chips'

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

  it('hides lowercase fragment titles without s-prefix (proj_ac6bbb1f leak)', () => {
    const truncated =
      'introduces the Michigan Senate race, and build a pointed comparison between Republican anti-Muslim fear-mongering and di'
    expect(isInternalClipReasoningText(truncated)).toBe(true)
    expect(
      clipDisplayTitle({
        title: truncated,
        aiMeta: { hook: 'Michigan Senate primary fight' },
      }),
    ).toBe('Michigan Senate primary fight')
  })

  it('falls back to transcript words when title is generic Clip', () => {
    expect(isGenericClipTitle('Clip')).toBe(true)
    expect(clipTitleFromTranscriptWords('Anti-Muslim rhetoric versus pushback in the primary')).toBe(
      'Anti-Muslim rhetoric versus pushback in the',
    )
    expect(
      clipDisplayTitle({
        title: 'Clip',
        aiMeta: {},
        spokenFirstLine: 'Anti-Muslim rhetoric versus pushback in the Michigan Senate primary race today',
      }),
    ).toBe('Anti-Muslim rhetoric versus pushback in the')
  })

  it('sanitizes Gemini span confirms descriptions', () => {
    const desc = "Strong hook; Gemini's 183.1-202.0 span confirms the two-sided critique."
    expect(isInternalClipReasoningText(desc)).toBe(true)
    expect(sanitizeClipDescriptionText(desc)).toBeNull()
    expect(
      clipScoreTooltipLines({
        score: 20,
        aiMeta: { hook: 'Anti-Muslim rhetoric vs pushback', videoWhy: 'Clear two-sided moment' },
        startMs: 0,
        endMs: 21_000,
      }).some((l) => l.includes('Gemini')),
    ).toBe(false)
    expect(clipWhySummary({ pass1_why: desc, hook: 'Primary stakes in one minute' })).toBe(
      'Primary stakes in one minute',
    )
  })
})
