import { describe, expect, it } from 'vitest'
import { reorderInsertBefore, isNoopReorder } from '@/lib/clips/editor/timeline-edit-ops'

const v = [
  { id: 'seg:0', startMs: 0, endMs: 2000 },
  { id: 'seg:2000', startMs: 2000, endMs: 4000 },
  { id: 'seg:4000', startMs: 4000, endMs: 10000 },
]

describe('TC4fix3 R2 reorder slot', () => {
  it('release over left half of Clip 2 inserts before Clip 2 regardless of grab offset', () => {
    const before = reorderInsertBefore(v, 'seg:4000', 4200 + (2500 - 4200))
    expect(before).toBe('seg:2000')
    expect(isNoopReorder(v, 'seg:4000', before)).toBe(false)
  })

  it('dropping a clip back in its own slot is a no-op', () => {
    expect(isNoopReorder(v, 'seg:4000', reorderInsertBefore(v, 'seg:4000', 9000))).toBe(true)
  })
})
