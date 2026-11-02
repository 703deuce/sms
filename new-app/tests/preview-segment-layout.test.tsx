// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { defaultEdits } from '@/lib/clips/edits'
import { PreviewSegmentLayout, segmentLayoutAtSourceMs } from '@/components/clips/editor/segment-layout-preview'
import type { ClipMediaSource } from '@/lib/clips/editor/sources'

describe('PreviewSegmentLayout', () => {
  const angle2: ClipMediaSource = {
    id: 'a2',
    ref: 'upload',
    refId: 'u2',
    mediaType: 'video',
    syncMs: 0,
  }
  const bounds = { clipStartMs: 0, clipEndMs: 60_000, trimMinMs: 0, trimMaxMs: 60_000 }

  it('renders two panes for side_by_side at playhead only', () => {
    const edits = {
      ...defaultEdits(bounds),
      sources: [angle2],
      sourceSegments: [
        { id: 's1', sourceId: 'a2', startMs: 10_000, endMs: 32_000, layout: { kind: 'side_by_side', withSourceId: 'main', split: 0.5 } },
      ],
    }
    expect(segmentLayoutAtSourceMs(edits, 15_000)).toBeTruthy()
    expect(segmentLayoutAtSourceMs(edits, 5000)).toBeNull()

    const active = segmentLayoutAtSourceMs(edits, 15_000)!
    const { getByTestId, queryByTestId } = render(
      <PreviewSegmentLayout
        edits={edits}
        seg={active.seg}
        layout={active.layout}
        previewSourceMs={15_000}
        sourceUrls={{ u2: 'https://example.com/a2.mp4' }}
        mainVideoUrl="https://example.com/main.mp4"
        mediaOffsetMs={0}
        playing={false}
      />,
    )
    expect(getByTestId('preview-layout-pane-0')).toBeTruthy()
    expect(getByTestId('preview-layout-pane-1')).toBeTruthy()
    expect(queryByTestId('preview-layout-pane-2')).toBeNull()
  })
})
