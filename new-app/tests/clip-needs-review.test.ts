// @vitest-environment node
// @ts-expect-error root tsc does not resolve the new-app vitest install
import { describe, expect, it } from 'vitest'
import { clipNeedsReview, clipNeedsReviewReasons, shareAiMetaAfterClipFetch, SHARE_STATUS_UNKNOWN_REASON } from '../lib/clips/clip-needs-review'

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

describe('shareAiMetaAfterClipFetch (exports-list Share)', () => {
  it('passes through aiMeta when the clip GET succeeds', () => {
    const flagged = { needsReview: true, needsReviewReasons: ['Leftover filler'] }
    expect(shareAiMetaAfterClipFetch({ ok: true, aiMeta: flagged })).toEqual(flagged)
    expect(clipNeedsReview(shareAiMetaAfterClipFetch({ ok: true, aiMeta: flagged }))).toBe(true)
    expect(shareAiMetaAfterClipFetch({ ok: true, aiMeta: undefined })).toBeUndefined()
    expect(clipNeedsReview(shareAiMetaAfterClipFetch({ ok: true, aiMeta: undefined }))).toBe(false)
    expect(clipNeedsReview(shareAiMetaAfterClipFetch({ ok: true, aiMeta: { needsReview: false } }))).toBe(false)
  })

  it('fails closed when the clip GET fails, so Share shows the needsReview confirm', () => {
    const meta = shareAiMetaAfterClipFetch({ ok: false })
    expect(clipNeedsReview(meta)).toBe(true)
    expect(clipNeedsReviewReasons(meta)).toEqual([SHARE_STATUS_UNKNOWN_REASON])
  })
})
