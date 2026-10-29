import { describe, expect, it } from 'vitest'
import { normalizeEdits, defaultEdits } from '@/lib/clips/edits'
import { headlinePreviewBoxMetrics } from '@/lib/clips/headline-preview-style'
import { headlineStyleForPreset } from '@/lib/clips/overlay-geometry'

const bounds = { clipStartMs: 0, clipEndMs: 60_000 }

describe('caption activeStyle normalize', () => {
  it('keeps activeStyle and highlightColor when valid', () => {
    const base = defaultEdits(bounds)
    const out = normalizeEdits(
      {
        ...base,
        captions: {
          ...base.captions,
          activeStyle: 'highlight',
          highlightColor: '#FDE047',
        },
      },
      bounds,
    )
    expect(out.captions.activeStyle).toBe('highlight')
    expect(out.captions.highlightColor).toBe('#FDE047')
  })

  it('drops invalid highlight hex', () => {
    const base = defaultEdits(bounds)
    const out = normalizeEdits(
      {
        ...base,
        captions: { ...base.captions, highlightColor: 'yellow' },
      },
      bounds,
    )
    expect(out.captions.highlightColor).toBeUndefined()
  })
})

describe('headline preview box', () => {
  it('computes width and radius at 1080x1920', () => {
    const style = { ...headlineStyleForPreset('export_bar'), widthPct: 80, radiusPx: 24 }
    const m = headlinePreviewBoxMetrics(1080, 1920, style)
    expect(m.width).toBe(864)
    expect(m.left).toBe(108)
    expect(m.borderRadius).toBe(24)
  })
})
