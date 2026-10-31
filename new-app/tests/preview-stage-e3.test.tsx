// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { PreviewStage } from '@/components/clips/editor/preview-stage'
import { normalizeEdits } from '@/lib/clips/edits'

const bounds = { clipStartMs: 0, clipEndMs: 20000 }

describe('PreviewStage E3 layers', () => {
  it('renders the transition clones, sorted B-roll boxes and keeps the main video unique', () => {
    const edits = normalizeEdits(
      {
        v: 2,
        trim: { in: 0, out: 20000 },
        cutRanges: [[3000, 4000]],
        broll: [
          { id: 'b2', source: 'stock', assetId: 'a2', startMs: 9000, endMs: 11000, transitionIn: { type: 'crossfade', durMs: 400 } },
          { id: 'b1', source: 'stock', assetId: 'a1', startMs: 6000, endMs: 9000 },
        ],
        transitions: [{ srcMs: 4000, type: 'push_left', durMs: 400 }],
        keyframes: [{ target: 'video', prop: 'scale', points: [{ tMs: 0, v: 100 }, { tMs: 2000, v: 120 }] }],
      },
      bounds,
    )
    expect(edits.transitions).toHaveLength(1)
    const r = render(
      <PreviewStage
        videoUrl="https://example.com/video.mp4"
        edits={edits}
        words={[{ i: 0, w: 'hi', s: 0.5, e: 1 }]}
        cropTrack={null}
        brollMedia={[
          { id: 'b1', source: 'stock', startMs: 6000, endMs: 9000, url: 'https://example.com/b1.mp4' },
          { id: 'b2', source: 'stock', startMs: 9000, endMs: 11000, url: 'https://example.com/b2.mp4' },
        ]}
        videoRef={{ current: null }}
        onTick={vi.fn()}
      />,
    )
    expect(r.getByTestId('preview-transition-a')).toBeTruthy()
    expect(r.getByTestId('preview-transition-b')).toBeTruthy()
    expect(r.getByTestId('preview-transition-color')).toBeTruthy()
    expect(r.getAllByTestId('preview-broll-layer').map((el) => el.getAttribute('data-broll-id'))).toEqual(['b1', 'b2'])
    // Clones are created lazily during a window → only one main video element at rest.
    expect(r.getByTestId('preview-transition-a').querySelector('video')).toBeNull()
  })
})
