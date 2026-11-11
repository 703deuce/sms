import { describe, expect, it } from 'vitest'
import { clipDisplayTitle, clipWhySummary, isInternalClipReasoningText, sanitizeClipDescriptionText } from '@/lib/clips/clip-results-chips'

describe('PR7 LG07 legacy card titles / sanitized descriptions', () => {
  it('does not cut fallback headlines in the middle of a word', () => {
    const long = 'The creator explains the underlying important difference between two possible workflows and why the second approach would work better if correctly configured'
    const got = clipDisplayTitle({ title: 'Clip', aiMeta: { hook: long } })
    expect(got.length).toBeLessThanOrEqual(120)
    expect(long.startsWith(got)).toBe(true)
    expect(got.endsWith(' ')).toBe(false)
    expect(long[got.length]).toBe(' ')
  })
  it('hides internal planning times while retaining clean explanatory copy', () => {
    const leaked = "Strong hook; Gemini's 183.1-202.0 span confirms the two-sided critique."
    expect(sanitizeClipDescriptionText(leaked)).toBeNull()
    expect(clipWhySummary({ hook: 'Clear customer-facing hook', pass1_why: leaked })).toBe('Clear customer-facing hook')
  })
  it('reliably rejects repeated internal sentence references rather than alternating due to regex state', () => {
    const leaked = 'This is the moment (s12-s15) that decides the clip'
    for (let i = 0; i < 10; i++) {
      expect(isInternalClipReasoningText(leaked)).toBe(true)
      expect(clipDisplayTitle({ title: leaked, aiMeta: { hook: 'Good clean hook' } })).toBe('Good clean hook')
    }
  })
  it('preserves an explicit user-authored title verbatim', () => {
    expect(clipDisplayTitle({ title: 'Custom clip title', aiMeta: {} })).toBe('Custom clip title')
  })
})
