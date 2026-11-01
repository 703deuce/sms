// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { Timeline } from '@/components/clips/editor/timeline'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { editorPreviewEdits } from '@/lib/clips/editor-preview-edits'
import { rollMainEdit } from '@/lib/clips/editor/trim-tools'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), message: vi.fn() }),
}))

const bounds = { clipStartMs: 0, clipEndMs: 40000, trimMinMs: 0, trimMaxMs: 40000 }
const words = Array.from({ length: 40 }, (_, i) => ({ i, w: `w${i}`, s: i * 0.9, e: i * 0.9 + 0.3 }))

function edits(patch: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return {
    ...normalizeEdits(defaultEdits(bounds), bounds),
    loopFriendlyEnd: false,
    ...patch,
  }
}

function setup(e: ClipEditsV2) {
  const onCommitEdits = vi.fn()
  const utils = render(
    <Timeline
      edits={e}
      words={words}
      shots={[]}
      outputMs={15000}
      clipOutputDurationMs={40000}
      onSeekOutput={() => {}}
      clipStartMs={bounds.clipStartMs}
      clipEndMs={bounds.clipEndMs}
      trimMinMs={bounds.trimMinMs}
      trimMaxMs={bounds.trimMaxMs}
      onCommitEdits={onCommitEdits}
      onUndo={vi.fn()}
      onRedo={vi.fn()}
      canUndo
    />,
  )
  const pxPerMs = () => parseFloat(utils.getByTestId('timeline-track').style.width) / 40000
  return { ...utils, onCommitEdits, pxPerMs }
}

function drag(el: Element, dxPx: number) {
  act(() => {
    fireEvent.pointerDown(el, { button: 0, clientX: 100, pointerId: 1 })
  })
  act(() => {
    fireEvent.pointerMove(window, { clientX: 100 + dxPx, pointerId: 1 })
  })
  act(() => {
    fireEvent.pointerUp(window, { clientX: 100 + dxPx, pointerId: 1 })
  })
}

describe('TL roll / slide pointer path', () => {
  afterEach(() => cleanup())

  it('roll on a videoSplit boundary commits videoSplits', () => {
    const e = edits({ videoSplits: [29700] })
    const { getByTestId, getAllByTestId, pxPerMs, onCommitEdits } = setup(e)
    fireEvent.keyDown(getByTestId('timeline-scroll'), { key: 'r' })
    const boundary = getAllByTestId('timeline-video-roll-boundary')[0]!
    drag(boundary, 500 * pxPerMs())
    expect(onCommitEdits).toHaveBeenCalled()
    const next = onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(next.videoSplits).toEqual([30200])
    expect(onCommitEdits.mock.calls.at(-1)![1]).toBe(true)
  })

  it('roll with preview silence-trim still commits (reducer uses committed keeps)', () => {
    const e = {
      ...edits({ videoSplits: [5000] }),
      silenceTrim: { enabled: true, minGapMs: 350, keepMs: 120, fillerTrim: true, protectReactionGaps: false },
    }
    const preview = editorPreviewEdits(e, words)
    const op = { edits: e, previewEdits: preview }
    expect(rollMainEdit(op, 5000, 300)!.videoSplits).toEqual([5300])
  })

  it('slide on a middle main-video clip commits videoSplits (contiguous splits)', () => {
    const e = edits({ videoSplits: [10000, 20000] })
    const { getByTestId, getAllByTestId, pxPerMs, onCommitEdits } = setup(e)
    fireEvent.keyDown(getByTestId('timeline-scroll'), { key: 'u' })
    const mid = getAllByTestId('timeline-item-video')[1]!
    drag(mid, 500 * pxPerMs())
    expect(onCommitEdits).toHaveBeenCalled()
    const next = onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(next.videoSplits).toEqual([10500, 20500])
    expect(onCommitEdits.mock.calls.at(-1)![1]).toBe(true)
  })

  it('slide on MC-style middle clip (4640–29210 ms) commits one undo step', () => {
    const e = edits({ videoSplits: [4640, 29210], trim: { in: 0, out: 35000 } })
    const { getByTestId, getAllByTestId, pxPerMs, onCommitEdits } = setup(e)
    fireEvent.keyDown(getByTestId('timeline-scroll'), { key: 'u' })
    const mid = getAllByTestId('timeline-item-video')[1]!
    drag(mid, 990 * pxPerMs())
    expect(onCommitEdits).toHaveBeenCalledTimes(1)
    const next = onCommitEdits.mock.calls[0]![0] as ClipEditsV2
    expect(next.videoSplits![0]! - 4640).toBeGreaterThan(800)
    expect(next.videoSplits![1]! - 29210).toBeGreaterThan(800)
    expect(onCommitEdits.mock.calls[0]![1]).toBe(true)
  })

  it('slide on a two-segment main track shows a toast instead of silent no-op', async () => {
    const { toast } = await import('sonner')
    const { getByTestId, getAllByTestId, pxPerMs } = setup(edits({ videoSplits: [29700] }))
    fireEvent.keyDown(getByTestId('timeline-scroll'), { key: 'u' })
    const seg = getAllByTestId('timeline-item-video')[0]!
    drag(seg, 200 * pxPerMs())
    expect(toast.message).toHaveBeenCalledWith(
      'Slide needs a middle main-video clip with neighbours on both sides',
      expect.objectContaining({ id: 'timeline-slide' }),
    )
  })
})
