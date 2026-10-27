import { describe, expect, it } from 'vitest'
import {
  layoutReservesHeadlineBand,
  layoutUsesLetterboxBlurPreview,
} from '@/lib/clips/layout-preview'
import { headlineBarAllowedForLayout } from '@/lib/clips/export-template'

describe('layout preview helpers', () => {
  it('full_frame uses letterbox blur and headline band', () => {
    expect(layoutUsesLetterboxBlurPreview('full_frame')).toBe(true)
    expect(layoutReservesHeadlineBand('full_frame')).toBe(true)
    expect(headlineBarAllowedForLayout('full_frame')).toBe(true)
  })

  it('split layouts block headline bar', () => {
    expect(headlineBarAllowedForLayout('split')).toBe(false)
    expect(headlineBarAllowedForLayout('grid3')).toBe(false)
    expect(layoutReservesHeadlineBand('split')).toBe(false)
  })
})
