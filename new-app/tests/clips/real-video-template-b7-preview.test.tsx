import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PreviewSegmentLayout, segmentLayoutAtSourceMs } from '@/components/clips/editor/segment-layout-preview'
import type { ClipEditsV2 } from '@/lib/clips/edits'

describe('Batch 7 photo composite preview parity', () => {
  it('renders image source-layout panes as images instead of broken video elements', () => {
    const edits = {
      v: 2, trim: { in: 0, out: 1000 }, cutRanges: [], wordFixes: {}, captions: {},
      layout: { mode: 'full_frame', shotOverrides: [] },
      sources: [
        { id: 'src_a', ref: 'upload', refId: 'photo_a', mediaType: 'image' },
        { id: 'src_b', ref: 'upload', refId: 'photo_b', mediaType: 'image' },
      ],
      sourceSegments: [{
        id: 'slot_a', sourceId: 'src_a', startMs: 0, endMs: 1000, fit: 'cover',
        layout: { kind: 'side_by_side', withSourceId: 'src_b', split: .5 },
      }],
    } as ClipEditsV2
    const active = segmentLayoutAtSourceMs(edits, 500)
    expect(active?.layout.kind).toBe('side_by_side')
    if (!active) throw new Error('layout missing')
    render(<PreviewSegmentLayout
      edits={edits}
      seg={active.seg}
      layout={active.layout}
      previewSourceMs={500}
      sourceUrls={{ photo_a: '/photo-a.png', photo_b: '/photo-b.png' }}
      mainVideoUrl={null}
      mediaOffsetMs={0}
      playing={false}
    />)
    const a = screen.getByTestId('preview-layout-pane-0-video')
    const b = screen.getByTestId('preview-layout-pane-1-video')
    expect(a.tagName).toBe('IMG')
    expect(b.tagName).toBe('IMG')
    expect(a).toHaveAttribute('src', '/photo-a.png')
    expect(b).toHaveAttribute('src', '/photo-b.png')
    expect(a).toHaveAttribute('data-layout-image', '1')
  })
})
