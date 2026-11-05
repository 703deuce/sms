import { describe, expect, it } from 'vitest'
import { refineWordCutWithAudio } from '@/lib/clips/editor/audio-cut-edges'
import type { GapRmsSample } from '@/lib/clips/gap-audio-trim'

const samples: GapRmsSample[] = []
for (let t = 300; t < 1800; t += 5) {
  const speech = (t >= 500 && t < 1000) || (t >= 1050 && t < 1200) || (t >= 1240 && t < 1650)
  samples.push({ tMs: t, rms: speech ? 0.7 : 0.005 })
}
describe('Editor audio cut edges', () => {
  it('never extends a filler cut into retained neighbours', () => {
    const r = refineWordCutWithAudio([1050, 1200], [
      { s: 0.5, e: 1.0 }, { s: 1.05, e: 1.2 }, { s: 1.24, e: 1.65 },
    ], samples)
    expect(r).not.toBeNull()
    expect(r!.range[0]).toBeGreaterThanOrEqual(1000)
    expect(r!.range[1]).toBeLessThanOrEqual(1240)
    expect(r!.range[0]).toBeLessThan(1125)
    expect(r!.range[1]).toBeGreaterThan(1125)
  })

  it('flags alignment that overlaps a kept word for manual review', () => {
    const r = refineWordCutWithAudio([1050, 1200], [
      { s: 0.5, e: 1.16 }, { s: 1.05, e: 1.2 }, { s: 1.24, e: 1.65 },
    ], samples)
    expect(r?.confidence).toBe('needs_review')
    expect(r?.note).toContain('overlapping')
  })
})
