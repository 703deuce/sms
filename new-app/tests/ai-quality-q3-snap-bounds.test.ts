import { describe, expect, it } from 'vitest'
import { buildSentenceSpans, snapClipBoundsMs } from '@/lib/clips/editor/snap-clip-bounds'

describe('Q3.2 snap clip bounds', () => {
  const words = [
    { w: 'Hello', s: 0, e: 0.3 },
    { w: 'world.', s: 0.3, e: 0.7 },
    { w: 'Next', s: 2.0, e: 2.2 },
    { w: 'topic', s: 2.2, e: 2.5 },
    { w: 'here.', s: 2.5, e: 2.9 },
  ]

  it('builds sentence spans on gaps and punctuation', () => {
    const s = buildSentenceSpans(words, 0, 5000)
    expect(s.length).toBe(2)
    expect(s[0]!.endMs).toBe(700)
    expect(s[1]!.startMs).toBe(2000)
  })

  it('snaps start after dead air to the next sentence', () => {
    const pick = { startMs: 1000, endMs: 2900 }
    const out = snapClipBoundsMs(pick, words, 0, 5000)
    expect(out.startMs).toBeGreaterThanOrEqual(2000)
    expect(out.endMs).toBeGreaterThan(out.startMs)
  })

  it('ends on sentence boundary with pad within window', () => {
    const pick = { startMs: 0, endMs: 650 }
    const out = snapClipBoundsMs(pick, words, 0, 5000)
    expect(out.endMs).toBeGreaterThanOrEqual(700)
  })
})
