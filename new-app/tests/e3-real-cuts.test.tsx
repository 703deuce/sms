// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { Timeline } from '@/components/clips/editor/timeline'
import { arrowStepMs, buildTimelineItems, realCutIndices, timebaseFor } from '@/lib/clips/editor/clip-timeline'
import { findTrack } from '@/lib/clips/editor/keyframes'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'

/** E3 × E2fix: transitions live on real cuts only — never on a Video split (the worker never sees splits). */
const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
function edits(patch: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return {
    ...normalizeEdits(defaultEdits(bounds), bounds),
    loopFriendlyEnd: false,
    cutRanges: [[3000, 4000]],
    videoSplits: [8000, 12000],
    ...patch,
  }
}
function setup(e: ClipEditsV2) {
  const onCommitEdits = vi.fn()
  const t = render(
    <Timeline
      edits={e}
      words={[]}
      shots={[]}
      outputMs={1000}
      clipOutputDurationMs={19000}
      onSeekOutput={vi.fn()}
      clipStartMs={0}
      clipEndMs={20000}
      trimMinMs={0}
      trimMaxMs={40000}
      onCommitEdits={onCommitEdits}
    />,
  )
  return { ...t, onCommitEdits }
}

afterEach(() => cleanup())

describe('E3 transitions × E2fix splits', () => {
  it('splits add Video-lane items but no cuts', () => {
    const e = edits()
    const tb = timebaseFor(e)
    expect(buildTimelineItems({ edits: e, previewEdits: e }).video).toHaveLength(4)
    expect(realCutIndices(tb)).toEqual([1])
  })

  it('offers a transition handle only at the real cut', () => {
    const t = setup(edits())
    const handles = t.getAllByTestId('timeline-transition-handle')
    expect(handles.map((h) => h.getAttribute('data-src-ms'))).toEqual(['4000'])
  })

  it('no cuts → no handles even with splits', () => {
    const t = setup(edits({ cutRanges: [] }))
    expect(t.queryAllByTestId('timeline-transition-handle')).toHaveLength(0)
  })

  it('arrows nudge a selected keyframe by one frame (Shift = 10)', () => {
    const e = edits({ cutRanges: [], videoSplits: undefined, keyframes: [{ target: 'video', prop: 'x', points: [{ tMs: 1000, v: 5 }] }] })
    const t = setup(e)
    const vid = t.getAllByTestId('timeline-item-video')[0]!
    act(() => void fireEvent.pointerDown(vid, { button: 0, clientX: 100, pointerId: 1 }))
    act(() => void fireEvent.pointerUp(window, { clientX: 100, pointerId: 1 }))
    const diamond = t.getAllByTestId('timeline-keyframe')[0]!
    act(() => void fireEvent.pointerDown(diamond, { button: 0, clientX: 100, pointerId: 2 }))
    act(() => void fireEvent.pointerUp(window, { clientX: 100, pointerId: 2 }))
    act(() => void fireEvent.keyDown(t.getByLabelText(/Timeline \(S split/), { key: 'ArrowRight' }))
    const next = t.onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(findTrack(next, 'video', 'x')!.points[0]!.tMs).toBe(1000 + arrowStepMs(false))
  })
})
