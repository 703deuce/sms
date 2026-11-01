import { describe, expect, it } from 'vitest'
import { defaultEdits } from '@/lib/clips/edits'
import { previewLayoutMode } from '@/components/clips/editor/preview-stage'

const B = { clipStartMs: 0, clipEndMs: 10_000 }

describe('previewLayoutMode', () => {
  it('landscape aspects force fit', () => {
    const base = defaultEdits(B)
    for (const aspect of ['16:9', '4:3', '21:9', 'custom:1920x1080'] as const) {
      expect(
        previewLayoutMode({
          ...base,
          aspectRatio: aspect,
          layout: { ...base.layout, mode: 'speaker_follow' },
        }),
      ).toBe('fit')
    }
  })

  it('portrait and square keep raw layout mode', () => {
    const base = defaultEdits(B)
    for (const aspect of ['9:16', '1:1', '4:5'] as const) {
      expect(
        previewLayoutMode({
          ...base,
          aspectRatio: aspect,
          layout: { ...base.layout, mode: 'speaker_follow' },
        }),
      ).toBe('speaker_follow')
    }
    expect(
      previewLayoutMode({
        ...base,
        aspectRatio: '9:16',
        layout: { ...base.layout, mode: 'fit_blur' },
      }),
    ).toBe('fit_blur')
  })
})
