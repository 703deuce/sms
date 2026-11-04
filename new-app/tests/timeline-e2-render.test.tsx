// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { Timeline } from '@/components/clips/editor/timeline'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
const words = Array.from({ length: 30 }, (_, i) => ({ i, w: `w${i}`, s: i * 0.6, e: i * 0.6 + 0.4 }))

function edits(patch: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return {
    ...normalizeEdits(defaultEdits(bounds), bounds),
    loopFriendlyEnd: false,
    cutRanges: [[3000, 4000]],
    broll: [
      { id: 'b1', source: 'stock', assetId: 'a1', startMs: 5000, endMs: 8000 },
      { id: 'b2', source: 'ai', generationId: 'g2', startMs: 12000, endMs: 14000 },
    ],
    audio: { music: { generationId: 'm1' }, sfx: [{ generationId: 's1', atMs: 9000 }] },
    ...patch,
  }
}

function setup(e: ClipEditsV2 = edits(), extra: Record<string, unknown> = {}) {
  const onCommitEdits = vi.fn()
  const onSeekOutput = vi.fn()
  const onUndo = vi.fn()
  const onRedo = vi.fn()
  const utils = render(
    <Timeline
      edits={e}
      words={words}
      shots={[]}
      outputMs={10000}
      clipOutputDurationMs={19000}
      onSeekOutput={onSeekOutput}
      clipStartMs={bounds.clipStartMs}
      clipEndMs={bounds.clipEndMs}
      trimMinMs={bounds.trimMinMs}
      trimMaxMs={bounds.trimMaxMs}
      onCommitEdits={onCommitEdits}
      onUndo={onUndo}
      onRedo={onRedo}
      canUndo
      {...extra}
    />,
  )
  const pxPerMs = () => parseFloat(utils.getByTestId('timeline-track').style.width) / 19000
  const broll = (id: string) =>
    utils.getAllByTestId('timeline-item-broll').find((el) => el.getAttribute('data-item-id') === id)!
  return { ...utils, onCommitEdits, onSeekOutput, onUndo, onRedo, pxPerMs, broll }
}

function drag(el: Element, dxPx: number, opts: { altKey?: boolean } = {}) {
  act(() => {
    fireEvent.pointerDown(el, { button: 0, clientX: 100, pointerId: 1 })
  })
  act(() => {
    fireEvent.pointerMove(window, { clientX: 100 + dxPx, pointerId: 1, altKey: opts.altKey })
  })
  act(() => {
    fireEvent.pointerUp(window, { clientX: 100 + dxPx, pointerId: 1 })
  })
}

describe('E2 multi-track timeline', () => {
  afterEach(() => cleanup())

  it('renders all lanes with headers on one output time base', () => {
    const { getByTestId } = setup()
    for (const lane of ['text', 'video', 'broll', 'voice', 'music', 'sfx']) {
      expect(getByTestId(`timeline-lane-${lane}`)).toBeTruthy()
      expect(getByTestId(`timeline-lane-header-${lane}`)).toBeTruthy()
    }
    expect(getByTestId('timeline-track').getAttribute('data-duration-ms')).toBe('19000')
  })

  it('keeps track labels aligned below the extra full-video moment row (C5)', () => {
    const { getByTestId } = setup(edits(), {
      momentFocus: {
        fromClipId: 'source-clip', startMs: 2000, endMs: 12000, title: 'Full video moment',
        onRangeChange: vi.fn(), onMakeClip: vi.fn(),
      },
      onMomentSeek: vi.fn(),
    })
    expect(getByTestId('full-video-moment-lane')).toBeTruthy()
    expect(getByTestId('timeline-auxiliary-header').style.height).toBe('36px')
    expect(getByTestId('timeline-lane-header-voice')).toBeTruthy()
  })

  it('B-roll bars sit at their OUTPUT time after a cut (old timeline drew them on the source span)', () => {
    const { broll, pxPerMs } = setup()
    expect(parseFloat(broll('b1').style.left)).toBeCloseTo(5000 * pxPerMs(), 3)
    expect(parseFloat(broll('b1').style.width)).toBeCloseTo(3000 * pxPerMs(), 3)
  })

  it('video lane shows the cut as two segments', () => {
    const { getAllByTestId } = setup()
    const segs = getAllByTestId('timeline-item-video').map((el) => [
      el.getAttribute('data-start-ms'),
      el.getAttribute('data-end-ms'),
    ])
    expect(segs).toEqual([
      ['0', '3000'],
      ['3000', '19000'],
    ])
  })

  it('drag-moves a B-roll item: one commit (one undo step), output ms', () => {
    const { broll, pxPerMs, onCommitEdits } = setup()
    drag(broll('b1'), 1000 * pxPerMs(), { altKey: true })
    expect(onCommitEdits).toHaveBeenCalledTimes(1)
    const next = onCommitEdits.mock.calls[0]![0] as ClipEditsV2
    expect(next.broll![0]).toMatchObject({ id: 'b1', startMs: 6000, endMs: 9000 })
  })

  it('snaps a moved item edge to the playhead when snapping is on', () => {
    const { broll, pxPerMs, onCommitEdits } = setup()
    // b1 end = 8000; playhead = 10000 → move by ~1.98 s, end snaps to 10000
    drag(broll('b1'), 1980 * pxPerMs())
    const next = onCommitEdits.mock.calls[0]![0] as ClipEditsV2
    expect(next.broll![0]).toMatchObject({ startMs: 7000, endMs: 10000 })
  })

  it('dragging a split main video clip commits a linked video/voice reorder (B1 magnet on)', () => {
    const e = edits({ cutRanges: [], videoSplits: [9000] })
    const { getAllByTestId, pxPerMs, onCommitEdits } = setup(e)
    const first = getAllByTestId('timeline-item-video')[0]!
    drag(first, 15000 * pxPerMs())
    expect(onCommitEdits).toHaveBeenCalledTimes(1)
    const next = onCommitEdits.mock.calls[0]![0] as ClipEditsV2
    expect(next.sectionOrder).toEqual([[9000, 20000], [0, 9000]])
  })

  it('B1: Magnet off keeps a real gap at the original position after dragging a split video', () => {
    localStorage.setItem('transovo.timeline.magnet', '0')
    try {
      const e = edits({ cutRanges: [], videoSplits: [9000] })
      const { getAllByTestId, pxPerMs, onCommitEdits } = setup(e)
      drag(getAllByTestId('timeline-item-video')[0]!, 15000 * pxPerMs())
      expect(onCommitEdits).toHaveBeenCalledTimes(1)
      const next = onCommitEdits.mock.calls[0]![0] as ClipEditsV2
      expect(next.sectionOrder).toEqual([[9000, 20000], [0, 9000]])
      expect(next.inserts).toEqual(expect.arrayContaining([
        expect.objectContaining({ sourceId: 'gap', durMs: 9000 }),
      ]))
    } finally {
      localStorage.removeItem('transovo.timeline.magnet')
    }
  })

  it('B1: a locked Video track cannot be reordered by dragging', () => {
    const e = edits({ cutRanges: [], videoSplits: [9000], timelineLanes: { video: { locked: true } } })
    const { getAllByTestId, pxPerMs, onCommitEdits } = setup(e)
    drag(getAllByTestId('timeline-item-video')[0]!, 15000 * pxPerMs())
    expect(onCommitEdits).not.toHaveBeenCalled()
  })

  it('trim handle on B-roll start advances the media in-point', () => {
    const { broll, pxPerMs, onCommitEdits } = setup()
    const handle = broll('b1').querySelector('[data-testid="timeline-trim-start"]')!
    drag(handle, 500 * pxPerMs(), { altKey: true })
    const next = onCommitEdits.mock.calls[0]![0] as ClipEditsV2
    expect(next.broll![0]).toMatchObject({ startMs: 5500, endMs: 8000, inMs: 500 })
  })

  it('S splits the selected B-roll at the playhead; Delete removes the selection (not the transcript)', () => {
    const windowKey = vi.fn()
    window.addEventListener('keydown', windowKey)
    const s = setup(edits({ broll: [{ id: 'b3', source: 'stock', assetId: 'a', startMs: 8000, endMs: 12000 }] }))
    act(() => {
      fireEvent.pointerDown(s.broll('b3'), { button: 0, clientX: 10 })
      fireEvent.pointerUp(window, { clientX: 10 })
    })
    expect(s.broll('b3').getAttribute('data-selected')).toBe('true')
    fireEvent.keyDown(s.getByTestId('timeline-scroll'), { key: 's' })
    const split = s.onCommitEdits.mock.calls[0]![0] as ClipEditsV2
    expect(split.broll).toEqual([
      expect.objectContaining({ id: 'b3', startMs: 8000, endMs: 10000 }),
      expect.objectContaining({ id: 'b3~10000', startMs: 10000, endMs: 12000, inMs: 2000 }),
    ])
    fireEvent.keyDown(s.getByTestId('timeline-scroll'), { key: 'Delete' })
    const del = s.onCommitEdits.mock.calls[1]![0] as ClipEditsV2
    expect(del.broll).toEqual([])
    // handled inside the timeline: the editor's global Delete (transcript cut) never sees it
    expect(windowKey).not.toHaveBeenCalled()
    window.removeEventListener('keydown', windowKey)
  })

  it('arrow keys nudge the selection by one frame (Shift = 10 frames)', () => {
    const { broll, onCommitEdits, getByTestId } = setup()
    act(() => {
      fireEvent.pointerDown(broll('b2'), { button: 0, clientX: 10 })
      fireEvent.pointerUp(window, { clientX: 10 })
    })
    fireEvent.keyDown(getByTestId('timeline-scroll'), { key: 'ArrowRight' })
    expect((onCommitEdits.mock.calls[0]![0] as ClipEditsV2).broll![1]).toMatchObject({ startMs: 12033 })
    fireEvent.keyDown(getByTestId('timeline-scroll'), { key: 'ArrowLeft', shiftKey: true })
    expect((onCommitEdits.mock.calls[1]![0] as ClipEditsV2).broll![1]).toMatchObject({ startMs: 11670 })
  })

  it('shift-click multi-selects; a group drag moves all selected items together', () => {
    const { broll, getByTestId, getAllByTestId, onCommitEdits, pxPerMs } = setup()
    act(() => {
      fireEvent.pointerDown(broll('b1'), { button: 0, clientX: 10 })
      fireEvent.pointerUp(window, { clientX: 10 })
      fireEvent.pointerDown(getAllByTestId('timeline-item-sfx')[0]!, { button: 0, clientX: 10, shiftKey: true })
      fireEvent.pointerUp(window, { clientX: 10 })
    })
    expect(getByTestId('timeline-selection-count').textContent).toContain('2')
    drag(broll('b1'), -1000 * pxPerMs(), { altKey: true })
    const next = onCommitEdits.mock.calls[0]![0] as ClipEditsV2
    expect(next.broll![0]).toMatchObject({ startMs: 4000 })
    expect(next.audio!.sfx[0]!.atMs).toBe(8000)
  })

  it('S with nothing selected splits the main video (layout boundary at the playhead)', () => {
    const { getByTestId, onCommitEdits } = setup()
    fireEvent.click(getByTestId('timeline-split'))
    const next = onCommitEdits.mock.calls[0]![0] as ClipEditsV2
    // playhead output 10000 → source 11000 (after the 1 s cut)
    expect(next.layout.layoutSegments!.some((s) => s.startMs === 11000 || s.endMs === 11000)).toBe(true)
  })

  it('lane header toggles mute / hide / lock through the edits model', () => {
    const { getByTestId, onCommitEdits } = setup()
    fireEvent.click(getByTestId('timeline-lane-mute-music'))
    expect((onCommitEdits.mock.calls[0]![0] as ClipEditsV2).timelineLanes).toEqual({ music: { muted: true } })
    fireEvent.click(getByTestId('timeline-lane-hide-broll'))
    expect((onCommitEdits.mock.calls[1]![0] as ClipEditsV2).timelineLanes).toEqual({ broll: { hidden: true } })
  })

  it('locked lanes ignore drags', () => {
    const { broll, pxPerMs, onCommitEdits } = setup(edits({ timelineLanes: { broll: { locked: true } } }))
    drag(broll('b1'), 1000 * pxPerMs(), { altKey: true })
    expect(onCommitEdits).not.toHaveBeenCalled()
  })

  it('Ctrl/Cmd+Z and Shift+Z route to undo / redo', () => {
    const { getByTestId, onUndo, onRedo } = setup()
    fireEvent.keyDown(getByTestId('timeline-scroll'), { key: 'z', ctrlKey: true })
    fireEvent.keyDown(getByTestId('timeline-scroll'), { key: 'z', metaKey: true, shiftKey: true })
    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(onRedo).toHaveBeenCalledTimes(1)
  })

  it('trimming the end of the main video moves trim.out and turns loop trim off', () => {
    const { getAllByTestId, pxPerMs, onCommitEdits } = setup()
    const last = getAllByTestId('timeline-item-video')[1]!
    const handle = last.querySelector('[data-testid="timeline-trim-end"]')!
    drag(handle, -2000 * pxPerMs(), { altKey: true })
    const next = onCommitEdits.mock.calls[0]![0] as ClipEditsV2
    expect(next.trim.out).toBe(18000)
    expect(next.loopFriendlyEnd).toBe(false)
  })

  it('without onCommitEdits the lanes are read-only', () => {
    const { getByTestId } = setup(edits(), { onCommitEdits: undefined })
    expect((getByTestId('timeline-split') as HTMLButtonElement).disabled).toBe(true)
  })
})
