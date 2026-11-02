// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { defaultEdits } from '@/lib/clips/edits'
import { MulticamSegmentLayoutControls } from '@/components/clips/editor/multicam-segment-layout-controls'
import type { ClipMediaSource } from '@/lib/clips/editor/sources'

const library: ClipMediaSource[] = [
  { id: 'a1', ref: 'upload', refId: 'u1', mediaType: 'video', syncMs: 0, label: 'A1' },
  { id: 'a2', ref: 'upload', refId: 'u2', mediaType: 'video', syncMs: 0, label: 'A2' },
]

describe('MulticamSegmentLayoutControls', () => {
  it('calls onEdits with layout on source segment when Side by side clicked', () => {
    const bounds = { clipStartMs: 0, clipEndMs: 60_000, trimMinMs: 0, trimMaxMs: 60_000 }
    const edits = {
      ...defaultEdits(bounds),
      trim: { in: 0, out: 32_000 },
      sources: library,
      sourceSegments: [{ id: 's1', sourceId: 'a2', startMs: 5000, endMs: 15_000 }],
    }
    const onEdits = vi.fn()
    const { getByTestId } = render(
      <MulticamSegmentLayoutControls edits={edits} library={library} playheadSourceMs={8000} onEdits={onEdits} />,
    )
    fireEvent.click(getByTestId('multicam-playhead-layout-side_by_side'))
    expect(onEdits).toHaveBeenCalledTimes(1)
    const next = onEdits.mock.calls[0]![0]
    const seg = next.sourceSegments?.find((s: { id: string }) => s.id === 's1')
    expect(seg?.layout?.kind).toBe('side_by_side')
    expect(seg?.layout?.withSourceId).toBeTruthy()
  })
})
