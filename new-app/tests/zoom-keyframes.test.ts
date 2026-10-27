import { describe, expect, it } from 'vitest'
import {
  buildZoomKeyframes,
  pickZoomPeakTimes,
  ZOOM_MAX_INTENSITY,
  ZOOM_MIN_GAP_S,
  clampZoomIntensity,
} from '@/lib/clips/zoom-keyframes'

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

  it('caps intensity at 1.15', () => {
    expect(clampZoomIntensity(1.3)).toBe(ZOOM_MAX_INTENSITY)
  })

  it('allows at most one punch per 4s', () => {
    const peaks = pickZoomPeakTimes([1, 3, 5, 8], 20, [])
    expect(peaks).toEqual([1, 5])
    expect(peaks[1] - peaks[0]).toBeGreaterThanOrEqual(ZOOM_MIN_GAP_S)
  })

  it('skips emphasis near layout speaker switch', () => {
    const words = [
      { s: 0, e: 0.5, w: 'a', i: 0, spk: 'A' },
      { s: 5, e: 5.5, w: 'b', i: 1, spk: 'B' },
    ]
    const kf = buildZoomKeyframes(words, [1], 10, 1.1)
    expect(kf.every((k) => k.z === 1)).toBe(true)
  })
})
