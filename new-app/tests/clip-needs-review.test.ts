// @vitest-environment node
// @ts-ignore — vitest is resolved in new-app; root tsc has no vitest types
import { describe, expect, it } from 'vitest'
import { clipNeedsReview, clipNeedsReviewReasons } from '../lib/clips/clip-needs-review'

describe('clipNeedsReview helpers', () => {
  it('returns false and no reasons when aiMeta is absent', () => {
    expect(clipNeedsReview(undefined)).toBe(false)
    expect(clipNeedsReview(null)).toBe(false)
    expect(clipNeedsReview({})).toBe(false)
    expect(clipNeedsReviewReasons(undefined)).toEqual([])
    expect(clipNeedsReviewReasons({ needsReviewReasons: ['leftover'] })).toEqual([])
  })

  it('is true only when needsReview is strictly true', () => {
    expect(clipNeedsReview({ needsReview: true })).toBe(true)
    expect(clipNeedsReview({ needsReview: false })).toBe(false)
    expect(clipNeedsReview({ needsReview: 'true' })).toBe(false)
    expect(clipNeedsReview({ needsReview: 1 })).toBe(false)
  })

  it('returns up to 10 trimmed string reasons when flagged', () => {
    expect(
      clipNeedsReviewReasons({
        needsReview: true,
        needsReviewReasons: ['  hook is weak  ', '', 12, 'overlap on beat 2', null],
      }),
    ).toEqual(['hook is weak', 'overlap on beat 2'])
    const many = Array.from({ length: 12 }, (_, i) => `reason ${i + 1}`)
    expect(clipNeedsReviewReasons({ needsReview: true, needsReviewReasons: many })).toEqual(many.slice(0, 10))
  })
})
