import { describe, expect, it } from 'vitest'
import { cropPx, stackHeights } from '@/lib/streamer/layout-math'

describe('layout-math', () => {
  it('matches worker stack height rounding', () => {
    expect(stackHeights(0.4)).toEqual({ faceH: 768, gameH: 1152 })
  })

  it('clamps crop inside frame', () => {
    const px = cropPx({ x: 0.9, y: 0.9, w: 0.2, h: 0.2 }, 1920, 1080)
    expect(px.x + px.w).toBeLessThanOrEqual(1920)
    expect(px.y + px.h).toBeLessThanOrEqual(1080)
  })
})
