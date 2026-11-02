// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { defaultEdits } from '@/lib/clips/edits'
import { MulticamSegmentLayoutControls } from '@/components/clips/editor/multicam-segment-layout-controls'
import { normalizeSourceSegments, type ClipMediaSource } from '@/lib/clips/editor/sources'

describe('MulticamSegmentLayoutControls', () => {
  const angle2: ClipMediaSource = {
    id: 'upl_77bebb',
    ref: 'upload',
    refId: 'ref_angle2',
    mediaType: 'video',
    syncMs: 0,
  }
  const mainUpload: ClipMediaSource = {
    id: 'upl_main',
    ref: 'upload',
    refId: 'ref_main',
    mediaType: 'video',
    syncMs: 0,
  }
  const library = [mainUpload, angle2, { id: 'upl_other', ref: 'upload', refId: 'x', mediaType: 'video' as const, syncMs: 0 }]

  it('persists pip with withSourceId main (registered partners only)', () => {
    const bounds = { clipStartMs: 0, clipEndMs: 60_000, trimMinMs: 0, trimMaxMs: 60_000 }
    const edits = {
      ...defaultEdits(bounds),
      trim: { in: 0, out: 32_000 },
      sources: [angle2],
      sourceSegments: [{ id: 's1', sourceId: angle2.id, startMs: 10_044, endMs: 32_000 }],
    }
    const onEdits = vi.fn()
    const { getByTestId } = render(
      <MulticamSegmentLayoutControls edits={edits} library={library} playheadSourceMs={15_000} onEdits={onEdits} />,
    )
    fireEvent.click(getByTestId('multicam-playhead-layout-pip'))
    expect(onEdits).toHaveBeenCalledTimes(1)
    const next = onEdits.mock.calls[0]![0]
    const seg = normalizeSourceSegments(next.sourceSegments, next.sources)?.[0]
    expect(seg?.layout?.kind).toBe('pip')
    expect(seg?.layout?.withSourceId).toBe('main')
  })
})
