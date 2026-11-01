import { describe, expect, it } from 'vitest'
import {
  extendCutForFillerFragment,
  gapMidpointMs,
  normalizeCleanupCutRange,
  snapCleanupCutRange,
} from '@/lib/clips/editor/cleanup-cut-boundaries'

const words = [
  { s: 0, e: 0.4, w: 'hello' },
  { s: 0.5, e: 0.55, w: 'uh' },
  { s: 0.56, e: 0.9, w: 'world' },
]

describe('cleanup-cut-boundaries', () => {
  it('snaps gap-style cut in silence between words', () => {
    const snapped = snapCleanupCutRange([420, 480], words)
    expect(snapped).not.toBeNull()
  })

  it('handles back-to-back words without splitting interiors', () => {
    const tight = [
      { s: 0, e: 0.3, w: 'a' },
      { s: 0.3, e: 0.6, w: 'b' },
    ]
    const cut = snapCleanupCutRange([300, 600], tight)
    expect(cut).toBeNull()
  })

  it('gap midpoint helper', () => {
    expect(gapMidpointMs(400, 600)).toBe(500)
  })

  it('extends filler fragment when RMS tail exceeds ASR end', () => {
    const rms = [
      { tMs: 520, rms: 0.02 },
      { tMs: 540, rms: 0.15 },
      { tMs: 560, rms: 0.12 },
    ]
    const extended = extendCutForFillerFragment([500, 550], 500, 530, rms, 0.08)
    expect(extended[1]).toBeGreaterThan(550)
  })

  it('normalize preserves exact filler word span', () => {
    const edgeWords = [{ s: 0, e: 0.08, w: 'um' }, { s: 0.2, e: 0.5, w: 'hi' }]
    const n = normalizeCleanupCutRange([0, 80], edgeWords)
    expect(n).toEqual([0, 80])
  })
})
