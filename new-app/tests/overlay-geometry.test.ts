import { describe, expect, it } from 'vitest'
import { badgeRect } from '@/lib/clips/overlay-geometry'
import { overlayLayout } from '@/lib/clips/stream-overlay-layout'

describe('overlay-geometry badgeRect', () => {
  it('matches export bar dimensions at 1080x1920', () => {
    const rect = badgeRect('export_bar', 1080, 1920, { videoY: 384, videoH: 998, text: 'TEST', showLogo: true })
    expect(rect.w).toBeGreaterThan(0)
    expect(rect.h).toBe(64)
    expect(rect.x).toBeGreaterThanOrEqual(0)
    expect(rect.y).toBeGreaterThan(0)
  })

  it('places badge at top-left margin for every placement', () => {
    const rect = badgeRect('fit_top_band', 1080, 1920, {
      videoY: 520,
      videoH: 608,
      badgeY: 1036,
      text: '2XRAKAI',
      showLogo: true,
    })
    expect(rect.x).toBe(24)
    expect(rect.y).toBe(24)
  })

  it('golden 2XRAKAI with logo at 1080x1920', () => {
    const rect = badgeRect('export_bar', 1080, 1920, {
      text: '2XRAKAI',
      showLogo: true,
      videoY: 384,
      videoH: 998,
    })
    expect(rect.w).toBe(235)
    expect(rect.h).toBe(64)
    expect(rect.x).toBe(24)
    expect(rect.y).toBe(24)
  })
})

describe('stream overlayLayout fit_top golden', () => {
  it('matches worker headline band for two lines at 1080x1920', () => {
    const lay = overlayLayout(2)
    expect(lay.headlineTop).toBe(150)
    expect(lay.headlineH).toBe(320)
    expect(lay.videoY).toBe(470)
    expect(lay.badgeY).toBe(lay.bottomY - 40)
  })
})
