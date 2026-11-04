import { describe, expect, it } from 'vitest'
import { LANE_H_DEFAULT, LANE_H_LAPTOP, laneHeights } from '@/lib/clips/editor/lane-heights'

describe('C1 laptop timeline density', () => {
  it('fits all six default tracks while preserving readable video and voice rows', () => {
    const heights = laneHeights({}, true)
    const total = ['text', 'broll', 'video', 'voice', 'music', 'sfx']
      .reduce((sum, lane) => sum + heights[lane as keyof typeof heights], 0)
    expect(total).toBeLessThanOrEqual(260)
    expect(heights.video).toBeGreaterThanOrEqual(60)
    expect(heights.sfx).toBeGreaterThanOrEqual(28)
  })

  it('uses regular row sizes on larger screens and never overwrites manually sized lanes', () => {
    expect(laneHeights({}, false)).toEqual(LANE_H_DEFAULT)
    expect(laneHeights({}, true)).toEqual(LANE_H_LAPTOP)
    expect(laneHeights({ video: 120, sfx: 60 }, true)).toMatchObject({ video: 120, sfx: 60 })
  })
})
