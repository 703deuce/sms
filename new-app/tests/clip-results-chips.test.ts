import { describe, expect, it } from 'vitest'
import { clipLayoutChip, clipWhySummary } from '@/lib/clips/clip-results-chips'

describe('clip-results-chips', () => {
  it('prefers pass1_why for plain why line', () => {
    expect(clipWhySummary({ pass1_why: 'Strong hook at question', hook: 'other' })).toBe('Strong hook at question')
  })

  it('maps layout resolved to chip label', () => {
    expect(clipLayoutChip({ layoutResolved: 'grid3' })).toBe('Grid 3-up')
  })
})
