import { describe, expect, it } from 'vitest'
import { findClipsConfirmText } from '@/components/clips/editor/find-clips-in-video-button'

describe('clipfinder editor helpers', () => {
  it('findClipsConfirmText includes credits when provided', () => {
    expect(findClipsConfirmText(5)).toContain('5 credits')
  })

  it('findClipsConfirmText omits credits sentence when null', () => {
    expect(findClipsConfirmText(null)).not.toContain('Est.')
  })
})
