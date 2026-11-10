import { describe, expect, it } from 'vitest'
import {
  CLEAN_TAKE_DEFAULT_STRENGTH,
  DEFAULT_CLEANUP_STRENGTH,
  fillerEligibleAtStrength,
  gapPresetForStrength,
  isProtectedFromCleanup,
  OPT_IN_FILLER_WORDS,
} from '../lib/clips/editor/cleanup-strength'
import { buildCleanTakeRunBody, cleanupPanelDefaultStrength } from '../lib/clips/editor/clean-take-review'

describe('cleanup-strength', () => {
  it('gap presets match spec defaults', () => {
    expect(gapPresetForStrength('normal')).toEqual({ minGapMs: 600, targetGapMs: 250 })
    expect(gapPresetForStrength('light')).toEqual({ minGapMs: 1000, targetGapMs: 400 })
    expect(gapPresetForStrength('aggressive')).toEqual({ minGapMs: 350, targetGapMs: 150 })
  })

  it('opt-in fillers excluded unless enabled', () => {
    expect(fillerEligibleAtStrength('like', 'lexicon', DEFAULT_CLEANUP_STRENGTH, new Set())).toBe(false)
    expect(fillerEligibleAtStrength('like', 'lexicon', 'aggressive', new Set(['like']))).toBe(true)
    expect(fillerEligibleAtStrength('you', 'lexicon', 'aggressive', new Set(['you know']))).toBe(false)
  })

  it('light strength only um/uh family', () => {
    expect(fillerEligibleAtStrength('uh', 'lexicon', 'light', new Set())).toBe(true)
    expect(fillerEligibleAtStrength('Uh,', 'lexicon', 'light', new Set())).toBe(true)
    expect(fillerEligibleAtStrength('um,', 'lexicon', 'normal', new Set())).toBe(true)
    expect(fillerEligibleAtStrength('hmm', 'lexicon', 'light', new Set())).toBe(false)
    expect(fillerEligibleAtStrength('hmm', 'repeat', 'normal', new Set())).toBe(true)
  })

  it('protects laughter tags and low confidence', () => {
    expect(isProtectedFromCleanup({ text: '[laughter]', conf: 1 })).toBe(true)
    expect(isProtectedFromCleanup({ text: 'name', conf: 0.3 })).toBe(true)
    expect(isProtectedFromCleanup({ text: 'hello', conf: 0.9 })).toBe(false)
  })
})

describe('Clean Take first-pass default', () => {
  it('uses light without changing the manual cleanup default', () => {
    expect(CLEAN_TAKE_DEFAULT_STRENGTH).toBe('light')
    expect(DEFAULT_CLEANUP_STRENGTH).toBe('normal')
    expect(fillerEligibleAtStrength('like', 'lexicon', CLEAN_TAKE_DEFAULT_STRENGTH, new Set())).toBe(false)
    expect(OPT_IN_FILLER_WORDS).toContain('you know')
  })

  it('puts light on the run body and uses it as the CleanupPanel default when provided', () => {
    const body = buildCleanTakeRunBody({ sources: [{ projectId: 'proj_1' }] })
    expect(body.fillerStrength).toBe(CLEAN_TAKE_DEFAULT_STRENGTH)
    expect(body.fillerStrength).toBe('light')
    expect(cleanupPanelDefaultStrength(CLEAN_TAKE_DEFAULT_STRENGTH)).toBe('light')
    expect(cleanupPanelDefaultStrength()).toBe(DEFAULT_CLEANUP_STRENGTH)
  })
})
