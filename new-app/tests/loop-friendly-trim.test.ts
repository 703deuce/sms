import { describe, expect, it } from 'vitest'
import { applyLoopFriendlyTrimToEdits, loopAlignmentScore } from '@/lib/clips/loop-friendly-trim'
import { defaultEdits } from '@/lib/clips/edits'

describe('loop-friendly trim', () => {
  it('scores overlapping opener and closer', () => {
    expect(loopAlignmentScore(['secret', 'growth'], ['secret', 'again'])).toBeGreaterThan(0.2)
  })

  it('trims end on tiktok when loopFriendlyEnd enabled', () => {
    const bounds = { clipStartMs: 0, clipEndMs: 10_000 }
    let edits = defaultEdits(bounds)
    edits.loopFriendlyEnd = true
    edits.trim.out = 8000
    const words = [
      { w: 'Hello', s: 0, e: 0.4, i: 0 },
      { w: 'world', s: 0.5, e: 0.9, i: 1 },
      { w: 'hello', s: 6.5, e: 7.0, i: 2 },
      { w: 'again!', s: 7.1, e: 7.5, i: 3 },
    ]
    edits = applyLoopFriendlyTrimToEdits(edits, words, { exportPlatform: 'tiktok' })
    expect(edits.trim.out).toBeLessThan(8000)
  })
})
