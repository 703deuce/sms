// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { KeyframeInspector } from '@/components/clips/editor/timeline/keyframe-inspector'
import { Timeline } from '@/components/clips/editor/timeline'
import { ItemSpeedControl } from '@/components/clips/editor/timeline/item-speed-control'
import { findTrack } from '@/lib/clips/editor/keyframes'
import { readCurveBars } from '@/lib/clips/editor/speed-curves'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
const words = Array.from({ length: 30 }, (_, i) => ({ i, w: `w${i}`, s: i * 0.6, e: i * 0.6 + 0.4 }))

function edits(patch: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return { ...normalizeEdits(defaultEdits(bounds), bounds), loopFriendlyEnd: false, ...patch }
}

describe('KF batch 1 UI', () => {
  afterEach(() => cleanup())

  it('ease graph commits bz on handle drag', () => {
    const onCommit = vi.fn()
    const e = edits({
      keyframes: [{ target: 'video', prop: 'x', points: [{ tMs: 0, v: 0 }, { tMs: 2000, v: 40 }] }],
    })
    const { getByTestId } = render(
      <KeyframeInspector edits={e} target="video" label="Video" localMs={0} onCommit={onCommit} onSeekLocal={() => {}} />,
    )
    fireEvent.click(getByTestId('kf-ease-x-curve'))
    expect(getByTestId('kf-graph-x')).toBeTruthy()
    const svg = getByTestId('kf-graph-x')
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ top: 0, left: 0, width: 96, height: 64 } as DOMRect)
    fireEvent.pointerDown(getByTestId('kf-graph-x-h0'), { clientY: 64 })
    fireEvent.pointerMove(window, { clientY: 0 })
    fireEvent.pointerUp(window)
    const next = onCommit.mock.calls.at(-1)![0] as ClipEditsV2
    expect(findTrack(next, 'video', 'x')!.points[0]!.bz?.[0]).toBe(1)
  })

  it('lanes toggle and empty state', () => {
    const onCommit = vi.fn()
    const { getByTestId, queryByTestId, rerender } = render(
      <KeyframeInspector
        edits={edits()}
        target="video"
        label="Video"
        localMs={500}
        span={{ fromMs: 0, toMs: 5000 }}
        onCommit={onCommit}
        onSeekLocal={() => {}}
      />,
    )
    expect(queryByTestId('kf-lanes-toggle')).toBeTruthy()
    fireEvent.click(getByTestId('kf-lanes-toggle'))
    expect(getByTestId('kf-lanes-empty')).toBeTruthy()
    rerender(
      <KeyframeInspector
        edits={edits({ keyframes: [{ target: 'video', prop: 'x', points: [{ tMs: 0, v: 0 }, { tMs: 2000, v: 10 }] }] })}
        target="video"
        label="Video"
        localMs={500}
        span={{ fromMs: 0, toMs: 5000 }}
        onCommit={onCommit}
        onSeekLocal={() => {}}
      />,
    )
    expect(getByTestId('kf-lane-x')).toBeTruthy()
    expect(getByTestId('kf-lane-x').querySelectorAll('[data-testid="kf-lane-key"]')).toHaveLength(2)
    cleanup()
    const noSpan = render(
      <KeyframeInspector edits={edits()} target="video" label="Video" localMs={0} onCommit={onCommit} onSeekLocal={() => {}} />,
    )
    expect(noSpan.queryByTestId('kf-lanes-toggle')).toBeNull()
  })

  it('multi-select diamonds and arrow nudge', () => {
    const onCommitEdits = vi.fn()
    const e = edits({
      keyframes: [{ target: 'broll:b1', prop: 'opacity', points: [{ tMs: 500, v: 100 }, { tMs: 2000, v: 0 }] }],
      broll: [{ id: 'b1', source: 'stock', assetId: 'a1', startMs: 5000, endMs: 8000 }],
    })
    const utils = render(
      <Timeline
        edits={e}
        words={words}
        shots={[]}
        outputMs={6000}
        clipOutputDurationMs={19000}
        onSeekOutput={() => {}}
        clipStartMs={bounds.clipStartMs}
        clipEndMs={bounds.clipEndMs}
        trimMinMs={bounds.trimMinMs}
        trimMaxMs={bounds.trimMaxMs}
        onCommitEdits={onCommitEdits}
      />,
    )
    const item = utils.getAllByTestId('timeline-item-broll').find((el) => el.getAttribute('data-item-id') === 'b1')!
    act(() => {
      fireEvent.pointerDown(item, { button: 0, clientX: 100, pointerId: 1 })
      fireEvent.pointerUp(window, { clientX: 100, pointerId: 1 })
    })
    const ds = utils.getAllByTestId('timeline-keyframe')
    act(() => {
      fireEvent.pointerDown(ds[0]!, { button: 0, clientX: 50, pointerId: 2 })
      fireEvent.pointerUp(window, { clientX: 50, pointerId: 2 })
    })
    act(() => {
      fireEvent.pointerDown(ds[1]!, { button: 0, clientX: 80, pointerId: 3, shiftKey: true })
    })
    expect(ds[0]!.getAttribute('data-selected')).toBe('true')
    expect(ds[1]!.getAttribute('data-selected')).toBe('true')
    act(() => {
      fireEvent.keyDown(utils.getByTestId('timeline-root'), { key: 'ArrowRight' })
    })
    expect(onCommitEdits).toHaveBeenCalled()
    const next = onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    const pts = findTrack(next, 'broll:b1', 'opacity')!.points.map((p) => p.tMs)
    expect(pts[0]).toBeCloseTo(500 + 1000 / 30, 0)
    expect(pts[1]).toBeCloseTo(2000 + 1000 / 30, 0)
  })

  it('Delete removes all selected keys in one commit', () => {
    const onCommitEdits = vi.fn()
    const e = edits({
      keyframes: [{ target: 'broll:b1', prop: 'x', points: [{ tMs: 0, v: 0 }, { tMs: 1000, v: 10 }] }],
      broll: [{ id: 'b1', source: 'stock', assetId: 'a1', startMs: 5000, endMs: 8000 }],
    })
    const utils = render(
      <Timeline
        edits={e}
        words={words}
        shots={[]}
        outputMs={5500}
        clipOutputDurationMs={19000}
        onSeekOutput={() => {}}
        clipStartMs={bounds.clipStartMs}
        clipEndMs={bounds.clipEndMs}
        trimMinMs={bounds.trimMinMs}
        trimMaxMs={bounds.trimMaxMs}
        onCommitEdits={onCommitEdits}
      />,
    )
    const item = utils.getByTestId('timeline-item-broll')
    act(() => {
      fireEvent.pointerDown(item, { button: 0, clientX: 100, pointerId: 1 })
      fireEvent.pointerUp(window, { clientX: 100, pointerId: 1 })
    })
    const ds = utils.getAllByTestId('timeline-keyframe')
    act(() => {
      fireEvent.pointerDown(ds[0]!, { button: 0, clientX: 50, pointerId: 2 })
      fireEvent.pointerUp(window, { clientX: 50, pointerId: 2 })
    })
    act(() => {
      fireEvent.pointerDown(ds[1]!, { button: 0, clientX: 80, pointerId: 3, shiftKey: true })
      fireEvent.pointerUp(window, { clientX: 80, pointerId: 3, shiftKey: true })
    })
    const before = onCommitEdits.mock.calls.length
    act(() => {
      fireEvent.keyDown(utils.getByTestId('timeline-root'), { key: 'Delete' })
    })
    expect(onCommitEdits.mock.calls.length).toBe(before + 1)
    const next = onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(findTrack(next, 'broll:b1', 'x')!.points).toEqual([])
  })

  it('custom speed bars commit and label', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(
      <ItemSpeedControl edits={edits()} srcInMs={0} srcOutMs={4000} onCommit={onCommit} />,
    )
    fireEvent.click(getByTestId('item-speed-curve-custom'))
    const bars = getByTestId('item-speed-bars')
    expect(bars.querySelectorAll('[data-testid^="item-speed-bar-"]').length).toBeGreaterThan(0)
    vi.spyOn(bars, 'getBoundingClientRect').mockReturnValue({ top: 0, left: 0, width: 800, height: 64 } as DOMRect)
    fireEvent.pointerDown(bars, { clientX: 50, clientY: 48 })
    fireEvent.pointerMove(window, { clientX: 450, clientY: 8 })
    fireEvent.pointerUp(window)
    expect(onCommit).toHaveBeenCalled()
    const next = onCommit.mock.calls.at(-1)![0] as ClipEditsV2
    const read = readCurveBars(next.segmentSpeeds, 0, 4000)
    expect(read.some((b, i) => i > 0 && b !== read[0])).toBe(true)
    cleanup()
    const labeled = render(<ItemSpeedControl edits={next} srcInMs={0} srcOutMs={4000} onCommit={() => {}} />)
    expect(labeled.getByTestId('item-speed-value').textContent).toBe('Custom curve')
  })
})
