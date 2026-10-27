import { describe, expect, it } from 'vitest'
import {
  clipLayoutChip,
  clipPersonCount,
  clipWhySummary,
  isClipUserHidden,
} from '@/lib/clips/clip-results-chips'

describe('clip-results-chips', () => {
  it('prefers pass1_why for tooltip', () => {
    expect(clipWhySummary({ pass1_why: 'Strong hook', hook: 'x' })).toBe('Strong hook')
  })

  it('maps crop method to layout label', () => {
    expect(clipLayoutChip({ cropMethod: 'fit_blur' })).toBe('Fit + blur')
  })

  it('reads person count', () => {
    expect(clipPersonCount({ nPersons: 3 })).toBe(3)
  })

  it('detects user hidden', () => {
    expect(isClipUserHidden({ userHidden: true })).toBe(true)
  })
})
