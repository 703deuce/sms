import { describe, expect, it } from 'vitest'
import { defaultEdits } from '@/lib/clips/edits'
import {
  canReuseClipPreviewForExport,
  exportRequestMatchesClipPreview,
} from '@/lib/clips/export-preview-reuse'

const bounds = { clipStartMs: 0, clipEndMs: 60_000 }

describe('export preview reuse', () => {
  it('matches only 720p 9:16', () => {
    expect(exportRequestMatchesClipPreview('9:16', '720p')).toBe(true)
    expect(exportRequestMatchesClipPreview('9:16', '1080p')).toBe(false)
    expect(exportRequestMatchesClipPreview('1:1', '720p')).toBe(false)
    expect(exportRequestMatchesClipPreview('16:9', '1080p')).toBe(false)
  })

  it('allows preview fast path for default edits at preview spec', () => {
    expect(
      canReuseClipPreviewForExport({
        aspect: '9:16',
        resolution: '720p',
        edits: defaultEdits(bounds),
        bounds,
      }),
    ).toBe(true)
  })

  it('requires RENDER_CLIP when aspect or resolution differs', () => {
    const edits = defaultEdits(bounds)
    expect(
      canReuseClipPreviewForExport({ aspect: '9:16', resolution: '1080p', edits, bounds }),
    ).toBe(false)
    expect(
      canReuseClipPreviewForExport({ aspect: '1:1', resolution: '720p', edits, bounds }),
    ).toBe(false)
    expect(
      canReuseClipPreviewForExport({ aspect: '16:9', resolution: '1080p', edits, bounds }),
    ).toBe(false)
  })

  it('requires RENDER_CLIP when edits are not default', () => {
    const edits = {
      ...defaultEdits(bounds),
      trim: { in: 1000, out: 50_000 },
    }
    expect(
      canReuseClipPreviewForExport({ aspect: '9:16', resolution: '720p', edits, bounds }),
    ).toBe(false)
  })
})
