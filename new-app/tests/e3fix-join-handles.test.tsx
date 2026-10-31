// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'

vi.mock('@/lib/clips-api', () => ({ patchClip: vi.fn(() => Promise.resolve({})), clipsFetch: vi.fn() }))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), message: vi.fn() }),
}))

import { Timeline } from '@/components/clips/editor/timeline'
import { useEditorState } from '@/components/clips/editor/use-editor-state'
import {
  buildTimelineItems,
  joinVideoSplits,
  setLaneState,
  splitAt,
  videoJoinOptions,
  type OpCtx,
} from '@/lib/clips/editor/clip-timeline'
import {
  CUT_HANDLE_HIT_PX,
  CUT_HANDLE_MIN_GAP_PX,
  layoutCutHandles,
} from '@/lib/clips/editor/cut-handle-layout'
import { editorPreviewEdits } from '@/lib/clips/editor-preview-edits'
import { defaultEdits, editsPayloadForSave, mergeEditsPatch, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
const words = Array.from({ length: 24 }, (_, i) => {
  const s = i * 0.6 + (i >= 10 ? 0.8 : 0)
  return { i, w: `w${i}`, s, e: s + 0.4 }
})
function base(patch: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return { ...normalizeEdits(defaultEdits(bounds), bounds), loopFriendlyEnd: false, ...patch }
}
const ctxOf = (edits: ClipEditsV2): OpCtx => ({ edits, previewEdits: editorPreviewEdits(edits, words) })
const vids = (e: ClipEditsV2) => buildTimelineItems({ edits: e, previewEdits: ctxOf(e).previewEdits }).video

describe('E3fix: Join (remove a Video split) — model', () => {
  it('one selected half offers prev / next only across a split, never across a real cut', () => {
    // cut [8000,9000] → keep segs [0,8000],[9000,20000]; splits at 3000 and 12000
    const e = base({ cutRanges: [[8000, 9000]], videoSplits: [3000, 12000] })
    expect(vids(e).map((v) => v.id)).toEqual(['seg:0', 'seg:3000', 'seg:9000', 'seg:12000'])
    expect(videoJoinOptions(ctxOf(e), [{ lane: 'video', id: 'seg:3000' }])).toEqual({ prev: 3000, next: null, between: [] })
    expect(videoJoinOptions(ctxOf(e), [{ lane: 'video', id: 'seg:9000' }])).toEqual({ prev: null, next: 12000, between: [] })
    expect(videoJoinOptions(ctxOf(e), [{ lane: 'video', id: 'seg:0' }])).toEqual({ prev: null, next: 3000, between: [] })
  })

  it('two adjacent selected halves → between; non-adjacent or across a cut → nothing', () => {
    const e = base({ cutRanges: [[8000, 9000]], videoSplits: [3000, 12000] })
    const sel = (...ids: string[]) => ids.map((id) => ({ lane: 'video' as const, id }))
    expect(videoJoinOptions(ctxOf(e), sel('seg:0', 'seg:3000')).between).toEqual([3000])
    expect(videoJoinOptions(ctxOf(e), sel('seg:3000', 'seg:9000')).between).toEqual([])
    expect(videoJoinOptions(ctxOf(e), sel('seg:0', 'seg:9000')).between).toEqual([])
    expect(videoJoinOptions(ctxOf(e), sel('seg:9000', 'seg:12000', 'seg:0', 'seg:3000')).between).toEqual([3000, 12000])
  })

  it('join removes exactly that split point and the save payload clears an emptied list', () => {
    const split = splitAt(ctxOf(base()), [], 5000)!
    expect(vids(split)).toHaveLength(2)
    const joined = joinVideoSplits(ctxOf(split), [5000])!
    expect(joined.videoSplits).toEqual([])
    expect(vids(joined)).toHaveLength(1)
    const saved = mergeEditsPatch(split, editsPayloadForSave(joined), bounds)
    expect(saved.videoSplits).toBeUndefined()
    expect(joinVideoSplits(ctxOf(base()), [5000])).toBeNull()
  })

  it('locked Video lane: no join offered, join is a no-op', () => {
    const e = setLaneState(base({ videoSplits: [5000] }), 'video', { locked: true })
    expect(videoJoinOptions(ctxOf(e), [{ lane: 'video', id: 'seg:5000' }])).toEqual({ prev: null, next: null, between: [] })
    expect(joinVideoSplits(ctxOf(e), [5000])).toBeNull()
  })
})

function Harness({ initial }: { initial: ClipEditsV2 }) {
  const st = useEditorState('clip_e3fix_join', bounds, initial)
  return (
    <>
      <Timeline
        edits={st.edits}
        words={words}
        shots={[]}
        outputMs={3000}
        clipOutputDurationMs={20000}
        onSeekOutput={() => {}}
        clipStartMs={bounds.clipStartMs}
        clipEndMs={bounds.clipEndMs}
        trimMinMs={bounds.trimMinMs}
        trimMaxMs={bounds.trimMaxMs}
        onCommitEdits={st.setEdits}
        onUndo={st.undo}
        onRedo={st.redo}
        canUndo={st.canUndo}
      />
      <output data-testid="splits">{JSON.stringify(st.edits.videoSplits ?? [])}</output>
    </>
  )
}

describe('E3fix: Join — rendered (right-click menu, two selected halves, undo)', () => {
  afterEach(() => cleanup())

  it('right-click the right half → Join with previous → one clip; Ctrl+Z restores the split', () => {
    const r = render(<Harness initial={base({ videoSplits: [5000] })} />)
    const items = () => r.getAllByTestId('timeline-item-video')
    expect(items()).toHaveLength(2)
    act(() => {
      fireEvent.contextMenu(items()[1]!, { clientX: 40, clientY: 40 })
    })
    expect(r.queryByTestId('timeline-join-next')).toBeNull()
    act(() => {
      fireEvent.click(r.getByTestId('timeline-join-prev'))
    })
    expect(items()).toHaveLength(1)
    expect(r.getByTestId('splits').textContent).toBe('[]')
    act(() => {
      fireEvent.keyDown(r.getByTestId('timeline-scroll'), { key: 'z', ctrlKey: true })
    })
    expect(items()).toHaveLength(2)
    expect(r.getByTestId('splits').textContent).toBe('[5000]')
  })

  it('shift-select two adjacent halves → toolbar Join (and menu "Join selected clips")', () => {
    const r = render(<Harness initial={base({ videoSplits: [5000, 10000] })} />)
    const items = () => r.getAllByTestId('timeline-item-video')
    expect(r.queryByTestId('timeline-join')).toBeNull()
    act(() => {
      fireEvent.pointerDown(items()[0]!, { button: 0, clientX: 10 })
      fireEvent.pointerUp(window, { clientX: 10 })
      fireEvent.pointerDown(items()[1]!, { button: 0, clientX: 10, shiftKey: true })
      fireEvent.pointerUp(window, { clientX: 10 })
    })
    act(() => {
      fireEvent.contextMenu(items()[1]!, { clientX: 40, clientY: 40 })
    })
    expect(r.getByTestId('timeline-join-selected')).toBeTruthy()
    act(() => {
      fireEvent.click(r.getByTestId('timeline-join'))
    })
    expect(r.getByTestId('splits').textContent).toBe('[10000]')
    expect(items()).toHaveLength(2)
  })
})

describe('E3fix: cut-transition handles — min hit area, no overlap', () => {
  afterEach(() => cleanup())

  it('25 px apart (Fit zoom repro): one row, full 24 px hit areas that do not overlap', () => {
    const s = layoutCutHandles([100, 125, 150])
    expect(s.map((x) => x.row)).toEqual([0, 0, 0])
    expect(s.every((x) => x.hitW === CUT_HANDLE_HIT_PX)).toBe(true)
    for (let i = 1; i < s.length; i++) expect(s[i]!.x - s[i]!.hitW / 2).toBeGreaterThanOrEqual(s[i - 1]!.x + s[i - 1]!.hitW / 2)
  })

  it('closer than the min gap: alternate rows; same-row hit areas never overlap', () => {
    const xs = [10, 20, 30, 40, 300]
    const s = layoutCutHandles(xs)
    expect(s.map((x) => x.row)).toEqual([0, 1, 0, 1, 0])
    for (const row of [0, 1]) {
      const r = s.filter((x) => x.row === row).sort((a, b) => a.x - b.x)
      for (let i = 1; i < r.length; i++) expect(r[i]!.x - r[i]!.hitW / 2).toBeGreaterThanOrEqual(r[i - 1]!.x + r[i - 1]!.hitW / 2 - 1e-9)
    }
    expect(s[4]!.hitW).toBe(CUT_HANDLE_HIT_PX)
    expect(CUT_HANDLE_MIN_GAP_PX).toBeLessThanOrEqual(CUT_HANDLE_HIT_PX)
    // input order is preserved
    expect(layoutCutHandles([40, 10]).map((x) => x.x)).toEqual([40, 10])
  })

  it('rendered handles carry the hit width (≥ 16 px icon) and stay clickable', () => {
    const e = base({ cutRanges: [[4000, 4300], [4600, 4900], [5200, 5500]] })
    const r = render(<Harness initial={e} />)
    const hs = r.getAllByTestId('timeline-transition-handle')
    expect(hs).toHaveLength(3)
    for (const h of hs) {
      const w = Number(h.getAttribute('data-hit-w'))
      expect(w).toBeGreaterThanOrEqual(6)
      expect(h.style.width).toBe(`${w}px`)
    }
    act(() => {
      fireEvent.click(hs[1]!)
    })
    expect(r.getByTestId('transition-duration')).toBeTruthy()
  })
})
