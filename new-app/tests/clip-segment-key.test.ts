import { describe, expect, it } from 'vitest'
import { formatClipSegmentKey } from '@/lib/clips/clip-segment-key'

describe('formatClipSegmentKey', () => {
  it('matches worker start:end format', () => {
    expect(formatClipSegmentKey(120_000, 185_500)).toBe('120000:185500')
  })
})
