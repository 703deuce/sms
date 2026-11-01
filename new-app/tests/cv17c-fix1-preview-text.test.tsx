// @vitest-environment happy-dom
/**
 * CV17c-fix1: PreviewStage must declare textRefs (plain text elRef) alongside textFxRefs.
 */
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { newTextItem } from '@/lib/clips/editor/text-items'
import { PreviewStage } from '@/components/clips/editor/preview-stage'

const bounds = { clipStartMs: 0, clipEndMs: 20_000, trimMinMs: 0, trimMaxMs: 40_000 }
const base = (): ClipEditsV2 => normalizeEdits(defaultEdits(bounds), bounds)

describe('CV17c-fix1 PreviewStage textRefs', () => {
  it('mounts with one text item without throwing', () => {
    const e = { ...base(), textItems: [newTextItem('t-fix', 0, 20_000, 'basic', 'Hello')] }
    expect(() =>
      render(
        <PreviewStage
          videoUrl="https://example.com/video.mp4"
          edits={e}
          words={[]}
          cropTrack={null}
          brollMedia={[]}
          videoRef={{ current: null }}
          onTick={vi.fn()}
          testBoxSize={{ w: 360, h: 640 }}
        />,
      ),
    ).not.toThrow()
  })
})
