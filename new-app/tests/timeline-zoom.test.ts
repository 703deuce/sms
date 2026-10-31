import { describe, expect, it } from 'vitest'
import {
  TIMELINE_DEFAULT_PX_PER_SEC,
  TIMELINE_MAX_PX_PER_SEC,
  TIMELINE_MIN_PX_PER_SEC,
  anchoredScrollLeft,
  autoscrollLeftForPlayhead,
  clampPxPerSec,
  fitPxPerSec,
  initialPxPerSec,
  outputMsToSourceMs,
  pxPerSecToSlider,
  sliderToPxPerSec,
  sourceMsToTrackPct,
  trackWidthPx,
  zoomBy,
  zoomPercent,
} from '@/lib/clips/editor/timeline-zoom'

describe('timeline zoom', () => {
  it('clamps scale and handles junk', () => {
    expect(clampPxPerSec(0)).toBe(TIMELINE_DEFAULT_PX_PER_SEC)
    expect(clampPxPerSec(Number.NaN)).toBe(TIMELINE_DEFAULT_PX_PER_SEC)
    expect(clampPxPerSec(1)).toBe(TIMELINE_MIN_PX_PER_SEC)
    expect(clampPxPerSec(1e6)).toBe(TIMELINE_MAX_PX_PER_SEC)
  })

  it('old fixed scale (~50px/s) was too small; default makes a 300ms word readable', () => {
    const oldWordPx = (300 / 20) // previous widthPx = span/20 => 0.05px/ms
    expect(oldWordPx).toBe(15)
    const span = 60_000
    const w = trackWidthPx(span, TIMELINE_DEFAULT_PX_PER_SEC)
    expect((w / span) * 300).toBeGreaterThanOrEqual(36)
  })

  it('fit-to-view fills the viewport exactly', () => {
    const px = fitPxPerSec(60_000, 900)
    expect(px).toBeCloseTo(15, 5)
    expect(trackWidthPx(60_000, px, 900)).toBe(900)
  })

  it('initial zoom uses default for long clips and fit for short ones', () => {
    expect(initialPxPerSec(60_000, 900)).toBe(TIMELINE_DEFAULT_PX_PER_SEC)
    expect(initialPxPerSec(5_000, 900)).toBe(180)
  })

  it('track never narrower than viewport', () => {
    expect(trackWidthPx(1_000, 10, 800)).toBe(800)
  })

  it('zoom in/out steps and round-trips', () => {
    const z = zoomBy(100, 'in')
    expect(z).toBe(125)
    expect(zoomBy(z, 'out')).toBe(100)
    expect(zoomBy(TIMELINE_MAX_PX_PER_SEC, 'in')).toBe(TIMELINE_MAX_PX_PER_SEC)
  })

  it('anchored zoom keeps the point under the cursor fixed', () => {
    // content x under cursor = 500 + 200 = 700 of 2000 (35%); doubling width -> 1400 - 200 = 1200
    expect(
      anchoredScrollLeft({ scrollLeft: 500, anchorX: 200, prevWidthPx: 2000, nextWidthPx: 4000, viewportPx: 800 }),
    ).toBe(1200)
    expect(
      anchoredScrollLeft({ scrollLeft: 0, anchorX: 10, prevWidthPx: 2000, nextWidthPx: 800, viewportPx: 800 }),
    ).toBe(0)
    // with a 64px label column: track x under cursor = 500 + 264 - 64 = 700 -> 1400; scroll = 1400 + 64 - 264
    expect(
      anchoredScrollLeft({
        scrollLeft: 500,
        anchorX: 264,
        prevWidthPx: 2000,
        nextWidthPx: 4000,
        viewportPx: 872,
        offsetPx: 64,
        extraPx: 72,
      }),
    ).toBe(1200)
  })

  it('autoscroll only when the playhead leaves the window', () => {
    expect(autoscrollLeftForPlayhead({ playheadPx: 400, scrollLeft: 0, viewportPx: 800, trackWidthPx: 4000 })).toBeNull()
    expect(autoscrollLeftForPlayhead({ playheadPx: 900, scrollLeft: 0, viewportPx: 800, trackWidthPx: 4000 })).toBe(820)
    expect(autoscrollLeftForPlayhead({ playheadPx: 100, scrollLeft: 2000, viewportPx: 800, trackWidthPx: 4000 })).toBe(20)
    expect(autoscrollLeftForPlayhead({ playheadPx: 3990, scrollLeft: 0, viewportPx: 800, trackWidthPx: 4000 })).toBe(3200)
  })

  it('slider mapping is monotonic and round-trips', () => {
    expect(sliderToPxPerSec(0)).toBeCloseTo(TIMELINE_MIN_PX_PER_SEC, 5)
    expect(sliderToPxPerSec(100)).toBeCloseTo(TIMELINE_MAX_PX_PER_SEC, 5)
    for (const v of [5, 30, 55, 80]) expect(pxPerSecToSlider(sliderToPxPerSec(v))).toBe(v)
    expect(zoomPercent(TIMELINE_DEFAULT_PX_PER_SEC)).toBe(100)
  })

  it('playhead maps output ms to source ms across cuts (was drawn in output space)', () => {
    // keep [0,1000) and [3000,5000): output 1500 -> source 3500; track span 0..5000 -> 70%
    const segs: Array<[number, number]> = [
      [0, 1000],
      [3000, 5000],
    ]
    const src = outputMsToSourceMs(1500, segs, 5000)
    expect(src).toBe(3500)
    expect(sourceMsToTrackPct(src, 0, 5000)).toBe(70)
    // the old formula (output/outputDuration) would have drawn it at 50%
    expect((1500 / 3000) * 100).toBe(50)
    expect(outputMsToSourceMs(99_999, segs, 5000)).toBe(5000)
  })
})
