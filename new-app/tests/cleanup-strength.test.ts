import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CLEANUP_STRENGTH,
  fillerEligibleAtStrength,
  gapPresetForStrength,
  isProtectedFromCleanup,
} from '@/lib/clips/editor/cleanup-strength'

describe('cleanup-strength', () => {
  it('gap presets match spec defaults', () => {
    expect(gapPresetForStrength('normal')).toEqual({ minGapMs: 600, targetGapMs: 250 })
    expect(gapPresetForStrength('light')).toEqual({ minGapMs: 1000, targetGapMs: 400 })
    expect(gapPresetForStrength('aggressive')).toEqual({ minGapMs: 350, targetGapMs: 150 })
  })

  it('opt-in fillers excluded unless enabled', () => {
    expect(fillerEligibleAtStrength('like', 'lexicon', DEFAULT_CLEANUP_STRENGTH, new Set())).toBe(false)
    expect(fillerEligibleAtStrength('like', 'lexicon', 'aggressive', new Set(['like']))).toBe(true)
  })

  it('light strength only um/uh family', () => {
    expect(fillerEligibleAtStrength('uh', 'lexicon', 'light', new Set())).toBe(true)
    expect(fillerEligibleAtStrength('hmm', 'lexicon', 'light', new Set())).toBe(false)
    expect(fillerEligibleAtStrength('hmm', 'repeat', 'normal', new Set())).toBe(true)
  })

  it('protects laughter tags and low confidence', () => {
    expect(isProtectedFromCleanup({ text: '[laughter]', conf: 1 })).toBe(true)
    expect(isProtectedFromCleanup({ text: 'name', conf: 0.3 })).toBe(true)
    expect(isProtectedFromCleanup({ text: 'hello', conf: 0.9 })).toBe(false)
  })
})
