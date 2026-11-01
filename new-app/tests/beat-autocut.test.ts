import { describe, expect, it } from 'vitest'
import { autoCutOverlays, beatGrid, beatSplitsForSegment } from '@/lib/clips/editor/beat-autocut'

describe('beat-autocut', () => {
  it('grid every 2 beats from nearest', () => {
    expect(beatGrid([0, 500, 1000, 1500, 2000], 2, 400)).toEqual([500, 1500])
  })

  it('redistributes overlays', () => {
    const { items, skipped } = autoCutOverlays(
      [{ id: 'a', startMs: 0, endMs: 2000, inMs: 0 }],
      [0, 1000, 2000, 3000],
      1,
      () => 5000,
    )
    expect(items[0]?.startMs).toBe(0)
    expect(items[0]?.endMs).toBe(1000)
    expect(skipped).toEqual([])
  })

  it('splits inside segment with min gap', () => {
    const splits = beatSplitsForSegment(
      { startMs: 0, endMs: 4000, srcIn: 0, srcOut: 4000 },
      [1000, 2000, 3000],
      1,
      (o) => o,
      [1500],
    )
    expect(splits).toContain(1000)
    expect(splits).toContain(3000)
    expect(splits.filter((s) => s === 1500)).toHaveLength(1)
  })
})
