import { describe, expect, it } from 'vitest'
import { normalizeEdits } from '@/lib/clips/edits'
import { effectiveCaptionEdits } from '@/lib/clips/caption-v2-bridge'
import { captionFitConfigForEdits } from '@/lib/clips/caption-fit'
import { buildCaptionsAss } from '@/lib/clips/render-plan/captions-ass'

const bounds = { clipStartMs: 0, clipEndMs: 10000, trimMinMs: 0, trimMaxMs: 10000 }
const words = [
  { w: 'IN', s: 0, e: 0.3, i: 0 },
  { w: 'THE', s: 0.3, e: 0.6, i: 1 },
  { w: 'MIDDLE', s: 0.6, e: 1, i: 2 },
]

describe('E8 caption size preview/export parity', () => {
  it('does not let stale classic size override a CP preset, but honors an explicit slider edit', () => {
    const base = { presetId: 'cp1', size: 6.5, position: 'top' }
    const unedited = effectiveCaptionEdits(base, true)
    expect('size' in unedited).toBe(false)
    const withSlider = effectiveCaptionEdits({ ...base, userSizePct: 10 }, true)
    expect(withSlider.userSizePct).toBe(10)
    expect('size' in withSlider).toBe(false)
    const small = captionFitConfigForEdits({ ...base, userSizePct: 3 }, true)
    const large = captionFitConfigForEdits({ ...base, userSizePct: 10 }, true)
    expect(large.fontsize).toBeGreaterThan(small.fontsize * 3)
  })

  it('retains the CP slider override through normalization and ASS export', () => {
    const small = normalizeEdits({ captions: { presetId: 'cp1', size: 6.5, userSizePct: 3, position: 'top' } }, bounds)
    const large = normalizeEdits({ captions: { presetId: 'cp1', size: 6.5, userSizePct: 10, position: 'top' } }, bounds)
    expect(large.captions.userSizePct).toBe(10)
    const a = buildCaptionsAss(words, small.captions, 720, 1280)
    const b = buildCaptionsAss(words, large.captions, 720, 1280)
    expect(a).not.toBe(b)
    const styleA = a.split('\n').find((line) => line.startsWith('Style: Cap,'))
    const styleB = b.split('\n').find((line) => line.startsWith('Style: Cap,'))
    expect(styleA).toBeTruthy()
    expect(styleB).toBeTruthy()
    expect(styleA).not.toBe(styleB)
  })
})
