import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { mainKeyAllowed } from '@/lib/clips/editor/main-fx'

const bounds = { clipStartMs: 0, clipEndMs: 10_000, trimMinMs: 0, trimMaxMs: 20_000 }
const base = () => normalizeEdits(defaultEdits(bounds), bounds)

describe('mainKeyAllowed', () => {
  it('allows plain speaker_follow', () => {
    expect(mainKeyAllowed(base())).toBe(true)
  })

  it('blocks source segments and letterbox layouts', () => {
    expect(mainKeyAllowed({ ...base(), sourceSegments: [{ id: 's', sourceId: 'u1', startMs: 0, endMs: 1000 }] })).toBe(false)
    expect(mainKeyAllowed({ ...base(), layout: { ...base().layout, mode: 'fit_blur' } })).toBe(false)
    expect(mainKeyAllowed({ ...base(), layout: { ...base().layout, mode: 'full_frame' } })).toBe(false)
  })

  it('blocks multi-panel layouts', () => {
    for (const mode of ['facecam_pip', 'stack', 'split', 'grid3'] as const) {
      expect(mainKeyAllowed({ ...base(), layout: { ...base().layout, mode } })).toBe(false)
    }
  })
})
