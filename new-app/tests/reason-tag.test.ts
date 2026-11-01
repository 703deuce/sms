import { describe, expect, it } from 'vitest'
import { clipReasonTag, inferReasonTag, wordsPerSecond } from '@/lib/clips/reason-tag'

describe('reason-tag', () => {
  it('stored tag wins', () => {
    expect(clipReasonTag({ reasonTag: 'visual' }, { wps: 2, startMs: 0, endMs: 1000 })).toBe('visual')
  })

  it('classifies visual / both / speech thresholds', () => {
    expect(inferReasonTag({ aiMeta: { videoMomentMatchIou: 0.5 }, wps: 0.5 })).toBe('visual')
    expect(inferReasonTag({ aiMeta: { videoMomentMatchIou: 0.5 }, wps: 1.2 })).toBe('both')
    expect(inferReasonTag({ aiMeta: { videoMomentMatchIou: 0.1 }, wps: 2 })).toBe('speech')
  })

  it('anything mode without moment match', () => {
    expect(inferReasonTag({ aiMeta: {}, wps: 0.2, mode: 'anything' })).toBe('visual')
    expect(inferReasonTag({ aiMeta: {}, wps: 2, mode: 'anything' })).toBe('both')
  })

  it('no words → visual only when moment matched', () => {
    expect(inferReasonTag({ aiMeta: { videoMomentMatchIou: 0.4 }, wps: 0 })).toBe('visual')
    expect(inferReasonTag({ aiMeta: { videoMomentMatchIou: 0 }, wps: 0 })).toBe('speech')
  })

  it('wordsPerSecond counts overlapping words', () => {
    const wps = wordsPerSecond(
      [
        { s: 1, e: 1.5 },
        { s: 1.4, e: 2 },
      ],
      1000,
      3000,
    )
    expect(wps).toBeGreaterThan(0)
  })
})
