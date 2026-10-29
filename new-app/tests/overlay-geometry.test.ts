import { describe, expect, it } from 'vitest'
import { badgeRect } from '@/lib/clips/overlay-geometry'

describe('overlay-geometry badgeRect', () => {
  it('matches export bar dimensions at 1080x1920', () => {
    const rect = badgeRect('export_bar', 1080, 1920, { videoY: 384, videoH: 998 })
    expect(rect.w).toBeGreaterThan(0)
    expect(rect.h).toBeGreaterThan(0)
    expect(rect.x).toBeGreaterThanOrEqual(0)
    expect(rect.y).toBeGreaterThan(0)
  })

  it('centers fit_top_band badge horizontally', () => {
    const rect = badgeRect('fit_top_band', 1080, 1920, { videoY: 520, videoH: 608 })
    expect(rect.x).toBe(Math.floor((1080 - rect.w) / 2))
  })
})
