// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { Timeline } from '@/components/clips/editor/timeline'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { findTrack } from '@/lib/clips/editor/keyframes'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
const words = Array.from({ length: 30 }, (_, i) => ({ i, w: `w${i}`, s: i * 0.6, e: i * 0.6 + 0.4 }))

function edits(patch: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return {
    ...normalizeEdits(defaultEdits(bounds), bounds),
    loopFriendlyEnd: false,
    cutRanges: [[3000, 4000]],
    broll: [{ id: 'b1', source: 'stock', assetId: 'a1', startMs: 5000, endMs: 8000 }],
    audio: { music: { generationId: 'm1' }, sfx: [] },
    ...patch,
  }
}

function setup(e: ClipEditsV2 = edits(), outputMs = 6000) {
  const onCommitEdits = vi.fn()
  const onSeekOutput = vi.fn()
  const utils = render(
    <Timeline
      edits={e}
      words={words}
      shots={[]}
      outputMs={outputMs}
      clipOutputDurationMs={19000}
      onSeekOutput={onSeekOutput}
      clipStartMs={bounds.clipStartMs}
      clipEndMs={bounds.clipEndMs}
      trimMinMs={bounds.trimMinMs}
      trimMaxMs={bounds.trimMaxMs}
      onCommitEdits={onCommitEdits}
    />,
  )
  const item = (lane: string, id?: string) =>
    utils.getAllByTestId(`timeline-item-${lane}`).find((el) => !id || el.getAttribute('data-item-id') === id)!
  const select = (el: Element) => {
    act(() => {
      fireEvent.pointerDown(el, { button: 0, clientX: 100, pointerId: 1 })
    })
    act(() => {
      fireEvent.pointerUp(window, { clientX: 100, pointerId: 1 })
    })
  }
  return { ...utils, onCommitEdits, onSeekOutput, item, select }
}

describe('E3 keyframes in the timeline', () => {
  afterEach(() => cleanup())

  it('selecting a B-roll item shows the inspector; ◇ adds a keyframe at the playhead (item-local ms)', () => {
    const t = setup()
    expect(t.queryByTestId('keyframe-inspector')).toBeNull()
    t.select(t.item('broll', 'b1'))
    const insp = t.getByTestId('keyframe-inspector')
    expect(insp.getAttribute('data-target')).toBe('broll:b1')
    for (const p of ['x', 'y', 'scale', 'rotation', 'opacity']) expect(t.getByTestId(`kf-toggle-${p}`)).toBeTruthy()
    act(() => {
      fireEvent.click(t.getByTestId('kf-toggle-scale'))
    })
    const next = t.onCommitEdits.mock.calls[0]![0] as ClipEditsV2
    expect(findTrack(next, 'broll:b1', 'scale')!.points).toEqual([{ tMs: 1000, v: 100 }])
  })

  it('Voice lane is selectable and offers only Volume', () => {
    const t = setup()
    t.select(t.item('voice'))
    expect(t.getByTestId('keyframe-inspector').getAttribute('data-target')).toBe('voice')
    expect(t.getByTestId('kf-toggle-volume')).toBeTruthy()
    expect(t.queryByTestId('kf-toggle-x')).toBeNull()
  })

  it('typing a value with keyframes present auto-keys at the playhead', () => {
    const t = setup(edits({ keyframes: [{ target: 'broll:b1', prop: 'x', points: [{ tMs: 0, v: 0 }] }] }))
    t.select(t.item('broll', 'b1'))
    const input = t.getByTestId('kf-value-x') as HTMLInputElement
    act(() => {
      fireEvent.change(input, { target: { value: '30' } })
    })
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    const next = t.onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(findTrack(next, 'broll:b1', 'x')!.points).toEqual([{ tMs: 0, v: 0 }, { tMs: 1000, v: 30 }])
  })

  it('diamonds render on the item; drag moves, Delete removes', () => {
    const e = edits({ keyframes: [{ target: 'broll:b1', prop: 'opacity', points: [{ tMs: 500, v: 100 }, { tMs: 2000, v: 0 }] }] })
    const t = setup(e)
    const ds = t.getAllByTestId('timeline-keyframe')
    expect(ds.map((d) => d.getAttribute('data-t-ms'))).toEqual(['500', '2000'])
    const track = t.getByTestId('timeline-track')
    const pxPerMs = parseFloat(track.style.width) / 19000
    act(() => {
      fireEvent.pointerDown(ds[1]!, { button: 0, clientX: 100, pointerId: 1 })
    })
    expect(t.onSeekOutput).toHaveBeenLastCalledWith(7000)
    act(() => {
      fireEvent.pointerMove(window, { clientX: 100 - 500 * pxPerMs, pointerId: 1 })
    })
    act(() => {
      fireEvent.pointerUp(window, { clientX: 100 - 500 * pxPerMs, pointerId: 1 })
    })
    const moved = t.onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(findTrack(moved, 'broll:b1', 'opacity')!.points.map((p) => p.tMs)).toEqual([500, 1500])
    act(() => {
      fireEvent.pointerDown(t.getAllByTestId('timeline-keyframe')[0]!, { button: 0, clientX: 50, pointerId: 1 })
    })
    act(() => {
      fireEvent.pointerUp(window, { clientX: 50, pointerId: 1 })
    })
    act(() => {
      fireEvent.keyDown(t.getByTestId('timeline-root'), { key: 'Delete' })
    })
    const del = t.onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(findTrack(del, 'broll:b1', 'opacity')!.points.map((p) => p.tMs)).toEqual([2000])
    expect(del.broll).toHaveLength(1) // the item itself is not deleted
  })
})

describe('E3 transitions in the timeline', () => {
  afterEach(() => cleanup())

  it('a handle sits on each Video-lane cut; the pop-over applies a transition with the default duration', () => {
    const t = setup()
    const h = t.getAllByTestId('timeline-transition-handle')
    expect(h).toHaveLength(1)
    expect(h[0]!.getAttribute('data-src-ms')).toBe('4000')
    act(() => {
      fireEvent.click(h[0]!)
    })
    expect(t.getByTestId('transition-popover')).toBeTruthy()
    for (const ty of ['crossfade', 'dip_black', 'dip_white', 'push_left', 'push_right', 'push_up', 'push_down', 'wipe_left', 'wipe_right', 'wipe_up', 'wipe_down', 'zoom_in', 'zoom_out', 'blur']) {
      expect(t.getByTestId(`transition-tile-${ty}`)).toBeTruthy()
    }
    act(() => {
      fireEvent.click(t.getByTestId('transition-tile-dip_black'))
    })
    const next = t.onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(next.transitions).toEqual([{ srcMs: 4000, type: 'dip_black', durMs: 400 }])
  })

  it('shows the transition window and lets the duration be changed', () => {
    const t = setup(edits({ transitions: [{ srcMs: 4000, type: 'crossfade', durMs: 400 }] }))
    expect(t.getByTestId('timeline-transition-region').getAttribute('data-type')).toBe('crossfade')
    act(() => {
      fireEvent.click(t.getByTestId('timeline-transition-handle'))
    })
    expect(t.getByTestId('transition-duration')).toBeTruthy() // design-system Slider (no native range)
    act(() => {
      fireEvent.click(t.getByTestId('transition-duration-inc'))
    })
    expect(t.getByTestId('transition-duration-label').textContent).toBe('0.50s')
    const next = t.onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(next.transitions).toEqual([{ srcMs: 4000, type: 'crossfade', durMs: 500 }])
    act(() => {
      fireEvent.click(t.getByTestId('transition-remove'))
    })
    expect((t.onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2).transitions).toBeUndefined()
  })

  it('B-roll edge buttons set in / out transitions', () => {
    const t = setup()
    act(() => {
      fireEvent.click(t.getByTestId('timeline-broll-transition-in'))
    })
    act(() => {
      fireEvent.click(t.getByTestId('transition-tile-zoom_in'))
    })
    const next = t.onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(next.broll![0]!.transitionIn).toEqual({ type: 'zoom_in', durMs: 400 })
  })
})
