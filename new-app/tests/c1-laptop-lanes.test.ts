import { describe, expect, it } from 'vitest'
import { LANE_H_DEFAULT, LANE_H_LAPTOP, laneHeights } from '@/lib/clips/editor/lane-heights'

describe('C1 laptop timeline density', () => {
  it('keeps enlarged tracks readable within a scrollable 65% laptop timeline', () => {
    const heights = laneHeights({}, true)
    const total = ['text', 'broll', 'video', 'voice', 'music', 'sfx']
      .reduce((sum, lane) => sum + heights[lane as keyof typeof heights], 0)
    expect(total).toBeLessThanOrEqual(340)
    expect(heights.video).toBe(100)
    expect(heights.voice).toBe(52)
    expect(heights.text).toBe(40)
    expect(heights.broll).toBe(48)
    expect(heights.music).toBe(40)
    expect(heights.sfx).toBe(40)
  })

  it('uses regular row sizes on larger screens and never overwrites manually sized lanes', () => {
    expect(laneHeights({}, false)).toEqual(LANE_H_DEFAULT)
    expect(laneHeights({}, true)).toEqual(LANE_H_LAPTOP)
    expect(laneHeights({ video: 120, sfx: 60 }, true)).toMatchObject({ video: 120, sfx: 60 })
  })
})
