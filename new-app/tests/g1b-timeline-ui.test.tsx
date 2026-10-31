// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { Timeline } from '@/components/clips/editor/timeline'
import { defaultEdits, normalizeEdits, orderedKeepSegments, type ClipEditsV2 } from '@/lib/clips/edits'
import { addTrack, setItemsTrack, trackIdOf, effectiveTracks } from '@/lib/clips/editor/tracks'
import { timelineClipboard } from '@/lib/clips/editor/timeline-edit-ops'
import { addEnvelopePoint, deleteEnvelopePoint, envelopeFor, envelopeValueAt, moveEnvelopePoint } from '@/lib/clips/editor/envelopes'
import { timelineCommandFor, nextShuttleRate, shuttleKey } from '@/lib/clips/editor/timeline-shortcuts'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
const words = Array.from({ length: 30 }, (_, i) => ({ i, w: `w${i}`, s: i * 0.6, e: i * 0.6 + 0.4 }))

function edits(patch: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return {
    ...normalizeEdits(defaultEdits(bounds), bounds),
    loopFriendlyEnd: false,
    broll: [
      { id: 'b1', source: 'stock', assetId: 'a1', startMs: 5000, endMs: 8000 },
      { id: 'b2', source: 'stock', assetId: 'a2', startMs: 12000, endMs: 14000 },
    ],
    ...patch,
  }
}

function setup(e: ClipEditsV2 = edits(), outputMs = 10000) {
  const onCommitEdits = vi.fn()
  const onSeekOutput = vi.fn()
  const utils = render(
    <Timeline
      edits={e}
      words={words}
      shots={[]}
      outputMs={outputMs}
      clipOutputDurationMs={20000}
      onSeekOutput={onSeekOutput}
      clipStartMs={0}
      clipEndMs={20000}
      trimMinMs={0}
      trimMaxMs={40000}
      onCommitEdits={onCommitEdits}
    />,
  )
  const item = (lane: string, id: string) =>
    utils.getAllByTestId(`timeline-item-${lane}`).find((el) => el.getAttribute('data-item-id') === id)!
  const last = () => onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
  return { ...utils, onCommitEdits, onSeekOutput, item, last }
}

describe('G1b timeline UI', () => {
  afterEach(() => {
    cleanup()
    timelineClipboard.set(null)
  })

  it('Add track menu adds a video overlay track row', () => {
    const { getByTestId, last } = setup()
    fireEvent.click(getByTestId('timeline-add-track'))
    fireEvent.click(getByTestId('timeline-add-track-overlay'))
    expect(effectiveTracks(last()).map((t) => t.id)).toContain('ov2')
  })

  it('extra tracks render as their own rows with headers; items sit on their track row', () => {
    let e = addTrack(edits(), 'overlay')!.edits
    e = setItemsTrack(e, 'overlay', ['b2'], 'ov2')!
    const { getByTestId } = setup(e)
    const row = getByTestId('timeline-lane-broll-ov2')
    expect(row.querySelector('[data-item-id="b2"]')).toBeTruthy()
    expect(getByTestId('timeline-lane-broll').querySelector('[data-item-id="b2"]')).toBeNull()
    expect(getByTestId('timeline-lane-header-broll-ov2').textContent).toContain('Overlay 2')
    fireEvent.click(getByTestId('timeline-lane-hide-broll-ov2'))
  })

  it('track header hide toggles the track (not the lane)', () => {
    const e = addTrack(edits(), 'overlay')!.edits
    const { getByTestId, last } = setup(e)
    fireEvent.click(getByTestId('timeline-lane-hide-broll-ov2'))
    expect(effectiveTracks(last()).find((t) => t.id === 'ov2')!.hidden).toBe(true)
    expect(last().timelineLanes).toBeUndefined()
  })

  it('Ctrl+C / Ctrl+V copies the selection and pastes it at the playhead', () => {
    const { item, getByTestId, last } = setup(edits(), 15000)
    act(() => {
      fireEvent.pointerDown(item('broll', 'b1'), { button: 0, clientX: 10 })
      fireEvent.pointerUp(window, { clientX: 10 })
    })
    const root = getByTestId('timeline-root')
    fireEvent.keyDown(root, { key: 'c', ctrlKey: true })
    expect(timelineClipboard.get()!.entries).toHaveLength(1)
    fireEvent.keyDown(root, { key: 'v', ctrlKey: true })
    const pasted = last().broll!.find((b) => !['b1', 'b2'].includes(b.id))!
    expect([pasted.startMs, pasted.endMs]).toEqual([15000, 18000])
  })

  it('Ctrl+D duplicates, I / O mark a range, Shift+Del deletes it with ripple', () => {
    const { item, getByTestId, last, rerender, onCommitEdits } = setup(edits(), 2000)
    act(() => {
      fireEvent.pointerDown(item('broll', 'b2'), { button: 0, clientX: 10 })
      fireEvent.pointerUp(window, { clientX: 10 })
    })
    const root = getByTestId('timeline-root')
    fireEvent.keyDown(root, { key: 'd', ctrlKey: true })
    expect(last().broll!.some((b) => b.startMs === 14000 && b.endMs === 16000)).toBe(true)
    fireEvent.keyDown(root, { key: 'i' })
    void rerender
    void onCommitEdits
    expect(getByTestId('timeline-inout-chip').textContent).toContain('In 2.00')
  })

  it('? opens the shortcuts sheet', () => {
    const { getByTestId, queryByTestId } = setup()
    fireEvent.keyDown(getByTestId('timeline-root'), { key: '?' })
    expect(getByTestId('timeline-shortcuts-sheet').textContent).toContain('Paste attributes')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(queryByTestId('timeline-shortcuts-sheet')).toBeNull()
  })

  it('drag a main-track clip before the first one reorders the video (sectionOrder)', () => {
    const e = edits({ videoSplits: [10000], broll: [] })
    const { item, last } = setup(e)
    const second = item('video', 'seg:10000')
    act(() => {
      fireEvent.pointerDown(second, { button: 0, clientX: 500 })
    })
    act(() => {
      fireEvent.pointerMove(window, { clientX: -2000 })
    })
    act(() => {
      fireEvent.pointerUp(window, { clientX: -2000 })
    })
    expect(orderedKeepSegments(last())).toEqual([
      [10000, 20000],
      [0, 10000],
    ])
  })

  it('Envelopes: toggle shows lines; clicking the line adds an opacity point', () => {
    const { getByTestId, getAllByTestId, last } = setup()
    fireEvent.click(getByTestId('timeline-envelopes'))
    const envs = getAllByTestId('timeline-envelope')
    expect(envs.some((x) => x.getAttribute('data-kind') === 'opacity')).toBe(true)
    expect(envs.some((x) => x.getAttribute('data-kind') === 'volume')).toBe(true)
    const hit = getAllByTestId('timeline-envelope-hit')[0]!
    fireEvent.pointerDown(hit, { button: 0, clientX: 20, clientY: 5 })
    expect(last().keyframes?.some((k) => k.prop === 'opacity' || k.prop === 'volume')).toBe(true)
  })
})

describe('G1b envelopes model', () => {
  const base = () => edits()
  it('targets: opacity on visual items, volume on voice / music, volume on SFX (G1b3), none on hook', () => {
    expect(envelopeFor('broll', 'b1')).toEqual({ target: 'broll:b1', prop: 'opacity' })
    expect(envelopeFor('video', 'seg:0')).toEqual({ target: 'video', prop: 'opacity' })
    expect(envelopeFor('voice', 'voice:0')).toEqual({ target: 'voice', prop: 'volume' })
    // G1b3: SFX get a volume envelope.
    expect(envelopeFor('sfx', 's1')).toEqual({ target: 'sfx:s1', prop: 'volume' })
    expect(envelopeFor('text', 'hook')).toBeNull()
  })
  it('add / drag / delete points = opacity keyframes, linear between (slope = fade speed)', () => {
    let e = addEnvelopePoint(base(), 'broll:b1', 'opacity', 0)
    e = addEnvelopePoint(e, 'broll:b1', 'opacity', 1000)
    e = moveEnvelopePoint(e, 'broll:b1', 'opacity', 1000, 1000, 0)
    expect(envelopeValueAt(e, 'broll:b1', 'opacity', 500)).toBe(50)
    // Points never cross their neighbours.
    e = moveEnvelopePoint(e, 'broll:b1', 'opacity', 1000, -50, 0)
    expect(e.keyframes![0]!.points.map((p) => p.tMs)).toEqual([0, 1])
    e = deleteEnvelopePoint(e, 'broll:b1', 'opacity', 1)
    e = deleteEnvelopePoint(e, 'broll:b1', 'opacity', 0)
    expect(e.keyframes).toBeUndefined()
  })
})

describe('G1b shortcuts map', () => {
  it('maps CapCut / Descript keys', () => {
    expect(timelineCommandFor({ key: 'b', ctrlKey: true })).toBe('split')
    expect(timelineCommandFor({ key: 'V', metaKey: true, shiftKey: true })).toBe('pasteAttributes')
    expect(timelineCommandFor({ key: 'd', ctrlKey: true })).toBe('duplicate')
    expect(timelineCommandFor({ key: 'Delete', shiftKey: true })).toBe('rippleDeleteRange')
    expect(timelineCommandFor({ key: 'x', altKey: true, code: 'KeyX' })).toBe('clearInOut')
    expect(timelineCommandFor({ key: 'ArrowUp' })).toBe('prevEdit')
    expect(timelineCommandFor({ key: 'j' })).toBeNull()
    expect(shuttleKey({ key: 'L' })).toBe('l')
    expect(nextShuttleRate(1)).toBe(2)
    expect(nextShuttleRate(8)).toBe(8)
  })
  void trackIdOf
})
