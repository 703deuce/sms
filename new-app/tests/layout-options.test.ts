import { describe, expect, it } from 'vitest'
import { layoutOptionDisabled, layoutPickPayload, LAYOUT_OPTIONS } from '@/lib/clips/layout-options'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'

describe('layout-options', () => {
  const bounds = { clipStartMs: 0, clipEndMs: 60_000 }

  it('allows facecam options on uploads without stream-detected boxes', () => {
    const pip = LAYOUT_OPTIONS.find((o) => o.id === 'facecam_pip')!
    expect(layoutOptionDisabled(pip, { facecamLayout: null, reframeV2Enabled: true, aiExtras: false })).toBe(false)
  })

  it('layoutPickPayload matches facecam payload shape', () => {
    const edits = normalizeEdits(defaultEdits(bounds), bounds)
    edits.layout.facecam = { pipCorner: 'TL' }
    const payload = layoutPickPayload(
      'facecam_pip',
      {
        facecam: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
        gameplay: { x: 0, y: 0, w: 1, h: 1 },
        split: 0.4,
        facecamPosition: 'top',
      },
      edits,
    )
    expect(payload.mode).toBe('facecam_pip')
    expect(payload.facecam?.box).toEqual({ x: 0.1, y: 0.1, w: 0.2, h: 0.2 })
    expect(payload.facecam?.pipCorner).toBe('TL')
  })
})
