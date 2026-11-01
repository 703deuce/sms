// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { Timeline } from '@/components/clips/editor/timeline'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { buildTimelineItems } from '@/lib/clips/editor/clip-timeline'
import { splitEdgeTrim } from '@/lib/clips/editor/trim-tools'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), message: vi.fn() }),
}))

const bounds = { clipStartMs: 0, clipEndMs: 40000, trimMinMs: 0, trimMaxMs: 40000 }
const words = Array.from({ length: 20 }, (_, i) => ({ i, w: `w${i}`, s: i * 1.2, e: i * 1.2 + 0.5 }))

function edits(patch: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return { ...normalizeEdits(defaultEdits(bounds), bounds), loopFriendlyEnd: false, ...patch }
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

function drag(el: Element, dxPx: number, opts: { altKey?: boolean } = {}) {
  act(() => {
    fireEvent.pointerDown(el, { button: 0, clientX: 100, pointerId: 1, altKey: opts.altKey })
  })
  act(() => {
    fireEvent.pointerMove(window, { clientX: 100 + dxPx, pointerId: 1, altKey: opts.altKey })
  })
  act(() => {
    fireEvent.pointerUp(window, { clientX: 100 + dxPx, pointerId: 1, altKey: opts.altKey })
  })
}

describe('TL-41 J/L at a video split', () => {
  afterEach(() => cleanup())

  it('Alt-drag Voice edge stores splitEdits keyed at the split (model)', () => {
    const e = edits({ videoSplits: [29210] })
    const lanes = buildTimelineItems({ edits: e, previewEdits: e })
    const v0 = lanes.voice.find((v) => v.id === 'voice:0')!
    const ctx = { edits: e, previewEdits: e }
    const next = splitEdgeTrim(ctx, { lane: 'voice', id: v0.id }, 'end', v0.endMs + 400)!
    expect(next.splitEdits).toEqual([{ atMs: 29210, audioMs: 400 }])
  })

  it('Alt-drag Voice edge on a videoSplit boundary commits undoable splitEdits', () => {
    const e = edits({ videoSplits: [29210] })
    const { getAllByTestId, pxPerMs, onCommitEdits } = setup(e)
    const v0 = getAllByTestId('timeline-item-voice')[0]!
    drag(v0.querySelector('[data-testid="timeline-trim-end"]')!, 400 * pxPerMs(), { altKey: true })
    expect(onCommitEdits).toHaveBeenCalled()
    const next = onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(next.splitEdits?.[0]?.atMs).toBe(29210)
    expect(onCommitEdits.mock.calls.at(-1)![1]).toBe(true)
  })
})

describe('TL-45 Takes hint', () => {
  afterEach(() => cleanup())

  it('two text items selected explains takes are for video / B-roll only', () => {
    const e = edits({
      textItems: [
        { id: 'a', text: 'a', startMs: 0, endMs: 2000, x: 0, y: 0, style: { font: 'Montserrat', size: 48, color: '#fff', align: 'center', case: 'none' } },
        { id: 'b', text: 'b', startMs: 3000, endMs: 5000, x: 0, y: 0, style: { font: 'Montserrat', size: 48, color: '#fff', align: 'center', case: 'none' } },
      ],
    })
    const { getAllByTestId, getByTestId } = setup(e)
    const items = getAllByTestId('timeline-item-text')
    act(() => {
      fireEvent.pointerDown(items[0]!, { button: 0, shiftKey: true })
      fireEvent.pointerUp(window)
      fireEvent.pointerDown(items[1]!, { button: 0, shiftKey: true })
      fireEvent.pointerUp(window)
    })
    fireEvent.click(getByTestId('timeline-takes-menu'))
    expect(getByTestId('timeline-toolbar-group-takes').textContent).toContain('Takes work on video or B-roll clips')
  })
})
