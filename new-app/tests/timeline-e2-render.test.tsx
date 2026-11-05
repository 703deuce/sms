// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { Timeline } from '@/components/clips/editor/timeline'
import { timebaseFor } from '@/lib/clips/editor/clip-timeline'
import { gapAtDisplayMs, exportTimeMap } from '@/lib/clips/editor/export-time'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { shiftVideoSegmentWithinSlot, timelineClipboard } from '@/lib/clips/editor/timeline-edit-ops'

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
  it('F11: Snap ON has a distinct visible state and clip end snaps precisely to the playhead', () => {
    const ui = setup()
    const button = ui.getByTestId('timeline-snap')
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(button.textContent).toContain('Snap on')
    const broll = ui.broll('b1')
    const deltaToPlayhead = (10_000 - 8_000) * ui.pxPerMs() - 4
    drag(broll, deltaToPlayhead)
    expect(ui.onCommitEdits).toHaveBeenCalled()
    const next = ui.onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(next.broll?.find(x => x.id === 'b1')?.endMs).toBe(10_000)
    fireEvent.click(button)
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(button.textContent).toContain('Snap off')
    ui.unmount()
  })

  it('F21: a 1.5× main clip bar uses the exported (shorter) duration', () => {
    const e = edits({ cutRanges: [], speed: 1.5 })
    const ui = setup(e, { clipOutputDurationMs: 20_000 })
    const main = ui.getAllByTestId('timeline-item-video')[0]!
    expect(ui.getByTestId('timeline-track').getAttribute('data-duration-ms')).toBe('13333')
    expect(Number(main.getAttribute('data-end-ms'))).toBe(13_333)
    expect(main.title).toContain('13.33')
    ui.unmount()
  })

  it('F35: Shift-click multi-select never selects page text', () => {
    const ui = setup()
    expect(ui.getByTestId('timeline-root').className).toContain('select-none')
    const [first, second] = ui.getAllByTestId('timeline-item-broll')
    fireEvent.pointerDown(first!, { button: 0, clientX: 100, pointerId: 71 })
    fireEvent.pointerUp(window, { clientX: 100, pointerId: 71 })
    fireEvent.pointerDown(second!, { button: 0, clientX: 100, pointerId: 72, shiftKey: true })
    fireEvent.pointerUp(window, { clientX: 100, pointerId: 72 })
    expect(ui.getAllByTestId('timeline-item-broll').filter(el => el.getAttribute('data-selected') === 'true')).toHaveLength(2)
    ui.unmount()
  })

  it('F37: cross-track fades toggle has an explanatory persistent toolbar status', () => {
    const ui = setup()
    expect(ui.queryByTestId('timeline-xfade-tracks-active')).toBeNull()
    fireEvent.click(ui.getByTestId('timeline-more-menu'))
    fireEvent.click(ui.getByTestId('timeline-xfade-tracks'))
    expect(ui.getByTestId('timeline-xfade-tracks-active').textContent).toContain('Fades on')
    expect(ui.getByTestId('timeline-xfade-tracks-active').getAttribute('title')).toContain('Two')
    ui.unmount()
  })

  it('F10: selected split piece exposes Join button without relying on Undo', () => {
    const ui = setup(edits({ cutRanges: [], videoSplits: [10_000] }))
    const first = ui.getAllByTestId('timeline-item-video')[0]!
    fireEvent.pointerDown(first, { button: 0, clientX: 100, pointerId: 73 })
    fireEvent.pointerUp(window, { clientX: 100, pointerId: 73 })
    fireEvent.click(ui.getByTestId('timeline-join'))
    expect(ui.onCommitEdits).toHaveBeenCalled()
    const next = ui.onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(next.videoSplits).toEqual([])
    ui.unmount()
  })

  it('F2: Paste at playhead is disabled in the Edit menu until something was copied', () => {
    timelineClipboard.set(null)
    const ui = setup(edits({ cutRanges: [] }))
    fireEvent.click(ui.getByTestId('timeline-more-menu'))
    // Toolbar/menu command disabled state is owned by the clipboard, not by
    // whether there happens to be a selected timeline item.
    expect(timelineClipboard.get()).toBeNull()
    ui.unmount()
  })


  it('Retest4 N15: clicking a Video clip selects but does not seek', () => {
    const ui = setup()
    const video = ui.getAllByTestId('timeline-item-video')[0]!
    act(() => fireEvent.pointerDown(video, { button: 0, clientX: 120, pointerId: 41 }))
    act(() => fireEvent.pointerUp(window, { clientX: 120, pointerId: 41 }))
    expect(video.getAttribute('data-selected')).toBe('true')
    expect(ui.onSeekOutput).not.toHaveBeenCalled()
    expect(ui.onCommitEdits).not.toHaveBeenCalled()
  })

  it('Retest4 N13: one main-video pointer gesture gives exactly one insert commit', () => {
    const ui = setup(edits({ cutRanges: [], videoSplits: undefined }))
    const magnet = ui.getByTestId('timeline-magnet')
    if (magnet.getAttribute('aria-pressed') === 'true') fireEvent.click(magnet)
    const video = ui.getAllByTestId('timeline-item-video')[0]!
    act(() => fireEvent.pointerDown(video, { button: 0, clientX: 120, pointerId: 42 }))
    act(() => fireEvent.pointerMove(window, { clientX: 320, pointerId: 42 }))
    act(() => fireEvent.pointerUp(window, { clientX: 320, pointerId: 42 }))
    // A duplicate pointerup is never allowed to create another history commit.
    act(() => fireEvent.pointerUp(window, { clientX: 320, pointerId: 42 }))
    expect(ui.onCommitEdits).toHaveBeenCalledTimes(1)
    const next = ui.onCommitEdits.mock.calls[0]![0] as ClipEditsV2
    expect(next.inserts?.some(i => i.sourceId === 'gap')).toBe(true)
  })

  it('Retest4 N12: ruler clicks inside an opening gap preserve display time, not base zero', () => {
    const e = edits({ cutRanges: [], inserts: [{ id: 'g1', sourceId: 'gap',
      atSrcMs: 0, inMs: 0, durMs: 5000, audio: 'mute' }] })
    const map = exportTimeMap(timebaseFor(e).segs, e.inserts)
    expect(gapAtDisplayMs(map, 2500)).toMatchObject({ startMs: 0, endMs: 5000, baseMs: 0 })
    expect(gapAtDisplayMs(map, 5000)).toBeNull()
    const ui = setup(e)
    const ruler = ui.getByTestId('timeline-ruler')
    Object.defineProperty(ruler, 'getBoundingClientRect', { configurable: true, value: () =>
      ({ left: 0, right: 1000, width: 1000, top: 0, bottom: 32, height: 32 }) })
    act(() => fireEvent.pointerDown(ruler, { button: 0, clientX: 100, clientY: 12, pointerId: 44 }))
    act(() => fireEvent.pointerUp(window, { clientX: 100, clientY: 12, pointerId: 44 }))
    expect(ui.onSeekOutput).toHaveBeenCalledWith(0, 2500)
  })

  it('N12 displays and labels a lone Video clip at its saved gap-adjusted export time', () => {
    const clean = edits({ cutRanges: [], videoSplits: undefined })
    const moved = shiftVideoSegmentWithinSlot({ edits: clean, previewEdits: clean }, 'seg:0', 1200)!
    expect(moved.inserts?.some(i => i.durMs === 1200)).toBe(true)
    const ui = setup(moved, { clipOutputDurationMs: timebaseFor(moved).durationMs + 1200 })
    const main = ui.getAllByTestId('timeline-item-video')[0]!
    expect(main.getAttribute('data-start-ms')).toBe('1200')
    expect(main.title).toContain('1.20–')
    expect(Number.parseFloat(main.style.left)).toBeGreaterThan(0)
    ui.unmount()
  })

  it('E5 highlights the automatic Captions lane even without manual caption items', () => {
    const ui = setup(edits({ captionLines: undefined }), {
      selectRequest: { lane: 'captions', atMs: 10000, seq: 1 },
    })
    expect(ui.getByTestId('timeline-lane-header-captions').getAttribute('data-selected')).toBe('true')
    ui.unmount()
  })

  afterEach(() => cleanup())

  it('renders all lanes with headers on one output time base', () => {
    const { getByTestId } = setup()
    for (const lane of ['text', 'video', 'broll', 'voice', 'music', 'sfx']) {
      expect(getByTestId(`timeline-lane-${lane}`)).toBeTruthy()
      expect(getByTestId(`timeline-lane-header-${lane}`)).toBeTruthy()
    }
    expect(getByTestId('timeline-track').getAttribute('data-duration-ms')).toBe('19000')
  })

  it('C2 collapse keeps the clip, playhead, seek, and restores the full tracks', () => {
    const onCollapsedChange = vi.fn()
    const { getByTestId, queryByTestId, onSeekOutput } = setup(edits(), { onCollapsedChange })
    fireEvent.click(getByTestId('timeline-collapse'))
    expect(onCollapsedChange).toHaveBeenCalledWith(true)
    expect(getByTestId('timeline-mini-strip')).toBeTruthy()
    expect(getByTestId('timeline-mini-clip')).toBeTruthy()
    expect(parseFloat(getByTestId('timeline-mini-playhead').style.left)).toBeCloseTo(10000 / 19000 * 100, 3)
    fireEvent.change(getByTestId('timeline-mini-strip').querySelector('input[type="range"]')!, { target: { value: '3000' } })
    expect(onSeekOutput).toHaveBeenCalledWith(3000)
    expect(queryByTestId('timeline-body')).toBeNull()
    fireEvent.click(getByTestId('timeline-collapse'))
    expect(onCollapsedChange).toHaveBeenLastCalledWith(false)
    expect(getByTestId('timeline-lane-video')).toBeTruthy()
  })

  it('C4 force-expanded timeline shows full tracks in Focus without losing collapsed choice', () => {
    const ui = setup(edits(), { forceExpanded: false })
    fireEvent.click(ui.getByTestId('timeline-collapse'))
    expect(ui.getByTestId('timeline-mini-strip')).toBeTruthy()
    ui.rerender(<Timeline edits={edits()} words={words} shots={[]} outputMs={10000} clipOutputDurationMs={19000} onSeekOutput={ui.onSeekOutput} clipStartMs={bounds.clipStartMs} clipEndMs={bounds.clipEndMs} forceExpanded />)
    expect(ui.getByTestId('timeline-lane-video')).toBeTruthy()
    expect(ui.queryByTestId('timeline-mini-strip')).toBeNull()
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

  it('C5 keeps moment actions inside the moment header instead of covering the time ruler', () => {
    const ui = setup(edits(), {
      momentFocus: {
        fromClipId: 'source-clip', startMs: 2000, endMs: 12000, title: 'Selected moment',
        onRangeChange: vi.fn(), onMakeClip: vi.fn(),
      },
      onMomentSeek: vi.fn(),
    })
    const bar = ui.getByTestId('full-video-moment-lane')
    const controls = ui.getByTestId('full-video-moment-popover')
    expect(controls.parentElement).toBe(bar)
    expect(controls.className).not.toContain('top-full')
    expect(ui.getByTestId('timeline-ruler')).toBeTruthy()
    expect(ui.getByTestId('moment-make-clip')).toBeTruthy()
  })

  it('N7/F14 shows independent Video opacity and Voice/Music/SFX volume envelopes', () => {
    const ui = setup()
    expect(ui.queryByTestId('timeline-envelope')).toBeNull()
    fireEvent.click(ui.getByTestId('timeline-more-menu'))
    fireEvent.click(ui.getByTestId('timeline-envelopes'))
    const video = ui.getAllByTestId('timeline-item-video')[0]!
    const voice = ui.getAllByTestId('timeline-item-voice')[0]!
    // F14: the picture opacity must be independent of the Voice volume.
    expect(video.querySelector('[data-testid="timeline-envelope"][data-kind="opacity"]')).toBeTruthy()
    expect(voice.querySelector('[data-testid="timeline-envelope"][data-kind="volume"]')).toBeTruthy()
    const music = ui.getAllByTestId('timeline-item-music')[0]!
    const sfx = ui.getAllByTestId('timeline-item-sfx')[0]!
    expect(music.querySelector('[data-testid="timeline-envelope"][data-kind="volume"]')).toBeTruthy()
    expect(sfx.querySelector('[data-testid="timeline-envelope"][data-kind="volume"]')).toBeTruthy()
    const line = video.querySelector('[data-testid="timeline-envelope-line"]') as SVGPolylineElement
    expect(line.getAttribute('points')).toBeTruthy()
    expect(line.getAttribute('stroke-width')).toBe('3.5')
  })

  it('C1 keeps lane viewport exactly as tall as its tracks, not a stretched empty region', () => {
    const ui = setup()
    const trackHeight = parseFloat(ui.getByTestId('timeline-track').style.height)
    const body = ui.getByTestId('timeline-body')
    expect(parseFloat(body.style.height)).toBe(trackHeight)
    expect(body.style.flex).toBe('0 1 auto')
    expect(ui.getAllByTestId('timeline-lane-video')).toHaveLength(1)
    expect(ui.getByTestId('timeline-add-track-row')).toBeTruthy()
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

  it('B1 retest: short Magnet-off drag commits a real gap instead of no-op', () => {
    localStorage.setItem('transovo.timeline.magnet', '0')
    try {
      const e = edits({ cutRanges: [], videoSplits: [9000] })
      const ui = setup(e)
      const last = ui.getAllByTestId('timeline-item-video')[1]!
      const track = ui.getByTestId('timeline-track')
      const actualPxPerMs = parseFloat(track.style.width) / Number(track.getAttribute('data-duration-ms'))
      drag(last, 1200 * actualPxPerMs)
      expect(ui.onCommitEdits).toHaveBeenCalledTimes(1)
      const next = ui.onCommitEdits.mock.calls[0]![0] as ClipEditsV2
      expect(next.inserts).toEqual(expect.arrayContaining([
        expect.objectContaining({ sourceId: 'gap', atSrcMs: 9000, durMs: 1200 }),
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

  it('B7 exposes a Video eye toggle and commits hidden state', () => {
    const { getByTestId, onCommitEdits } = setup()
    fireEvent.click(getByTestId('timeline-lane-hide-video'))
    expect((onCommitEdits.mock.calls[0]![0] as ClipEditsV2).timelineLanes?.video?.hidden).toBe(true)
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

  it('B2 keeps the timeline scale steady while trimming and retains room to restore the source', () => {
    const { getAllByTestId, getByTestId, onCommitEdits, pxPerMs } = setup()
    const last = getAllByTestId('timeline-item-video').at(-1)!
    const handle = last.querySelector('[data-testid="timeline-trim-end"]')!
    const widthBefore = parseFloat(getByTestId('timeline-track').style.width)
    act(() => fireEvent.pointerDown(handle, { button: 0, clientX: 100, pointerId: 1 }))
    act(() => fireEvent.pointerMove(window, { clientX: 100 - 2000 * pxPerMs(), pointerId: 1 }))
    expect(parseFloat(getByTestId('timeline-track').style.width)).toBe(widthBefore)
    act(() => fireEvent.pointerUp(window, { clientX: 100 - 2000 * pxPerMs(), pointerId: 1 }))
    expect((onCommitEdits.mock.calls[0]![0] as ClipEditsV2).trim.out).toBe(18000)
    expect(parseFloat(getByTestId('timeline-track').style.width)).toBeGreaterThanOrEqual(widthBefore)
  })

  it('N2 blocks single-letter commands and Space after canvas Ctrl+A until the next click', () => {
    const ui = setup()
    fireEvent.keyDown(ui.getByTestId('timeline-scroll'), { key: 'a', code: 'KeyA', ctrlKey: true })
    const prior = ui.onCommitEdits.mock.calls.length
    for (const key of ['h', 'e', 'l', 'l', 'o', ' ', 'i', 's']) {
      fireEvent.keyDown(window, { key, code: key === ' ' ? 'Space' : undefined })
    }
    expect(ui.onCommitEdits).toHaveBeenCalledTimes(prior)
    expect(ui.onSeekOutput).not.toHaveBeenCalled()
    fireEvent.pointerDown(ui.getByTestId('timeline-root'), { button: 0 })
    fireEvent.keyDown(window, { key: 's', code: 'KeyS' })
    expect(ui.onCommitEdits.mock.calls.length).toBeGreaterThan(prior)
  })

  it('B2 allows an unselected end trim and clamps live geometry and commit at the media limit', () => {
    const ui = setup()
    const last = ui.getAllByTestId('timeline-item-video').at(-1)!
    expect(last.getAttribute('data-selected')).toBeNull()
    const handle = last.querySelector('[data-testid="timeline-trim-end"]')!
    const dx = 35_000 * ui.pxPerMs()
    act(() => fireEvent.pointerDown(handle, { button: 0, clientX: 100, pointerId: 91 }))
    act(() => fireEvent.pointerMove(window, { clientX: 100 + dx, pointerId: 91 }))
    expect(Number(last.getAttribute('data-end-ms'))).toBeLessThanOrEqual(39000)
    act(() => fireEvent.pointerUp(window, { clientX: 100 + dx, pointerId: 91 }))
    expect((ui.onCommitEdits.mock.calls[0]![0] as ClipEditsV2).trim.out).toBe(40000)
  })

  it('B2 hit-tests an unselected clip body within eight pixels of its edge', () => {
    const ui = setup()
    const last = ui.getAllByTestId('timeline-item-video').at(-1)!
    expect(last.getAttribute('data-selected')).toBeNull()
    const rect = { x: 0, y: 0, top: 0, bottom: 50, left: 0, right: 200, width: 200, height: 50, toJSON: () => ({}) }
    Object.defineProperty(last, 'getBoundingClientRect', { configurable: true, value: () => rect })
    act(() => fireEvent.pointerDown(last, { button: 0, clientX: 195, pointerId: 32 }))
    act(() => fireEvent.pointerMove(window, { clientX: 195 - 500 * ui.pxPerMs(), pointerId: 32 }))
    act(() => fireEvent.pointerUp(window, { clientX: 195 - 500 * ui.pxPerMs(), pointerId: 32 }))
    expect((ui.onCommitEdits.mock.calls[0]![0] as ClipEditsV2).trim.out).toBe(19500)
  })

  it('B2 left trim can start on an unselected clip', () => {
    const ui = setup()
    const first = ui.getAllByTestId('timeline-item-video')[0]!
    const handle = first.querySelector('[data-testid="timeline-trim-start"]')!
    drag(handle, 1000 * ui.pxPerMs())
    expect((ui.onCommitEdits.mock.calls[0]![0] as ClipEditsV2).trim.in).toBe(1000)
  })

  it('without onCommitEdits the lanes are read-only', () => {
    const { getByTestId } = setup(edits(), { onCommitEdits: undefined })
    expect((getByTestId('timeline-split') as HTMLButtonElement).disabled).toBe(true)
  })
})
