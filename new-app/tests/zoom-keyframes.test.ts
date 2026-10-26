import { describe, expect, it } from 'vitest'
import { buildZoomKeyframes } from '@/lib/clips/zoom-keyframes'

describe('buildZoomKeyframes', () => {
  it('includes emphasis word time', () => {
    const kf = buildZoomKeyframes(
      [{ s: 2, e: 2.5, w: 'hook', i: 0 }],
      [0],
      10,
      1.15,
    )
    expect(kf.some((k) => k.z === 1.15)).toBe(true)
  })
})
