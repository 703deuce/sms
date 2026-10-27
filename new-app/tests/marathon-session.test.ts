import { describe, expect, it } from 'vitest'
import { shouldMergeStreamSegments, sessionEndFromSegment } from '@/lib/server/streamer/marathon-session'

describe('marathon session stitch', () => {
  it('merges when gap ≤ 10 min', () => {
    const end = sessionEndFromSegment('2026-10-27T12:00:00.000Z', 60 * 60_000)
    expect(shouldMergeStreamSegments(end, '2026-10-27T13:05:00.000Z')).toBe(true)
  })

  it('does not merge when gap > 10 min', () => {
    const end = sessionEndFromSegment('2026-10-27T12:00:00.000Z', 60_000)
    expect(shouldMergeStreamSegments(end, '2026-10-27T12:15:00.000Z')).toBe(false)
  })
})
