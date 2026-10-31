// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'

const toastMessage = vi.fn()
vi.mock('@/lib/clips-api', () => ({ patchClip: vi.fn(() => Promise.resolve({})), clipsFetch: vi.fn() }))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), message: (...a: unknown[]) => toastMessage(...a) }),
}))

import { Timeline } from '@/components/clips/editor/timeline'
import { useEditorState } from '@/components/clips/editor/use-editor-state'
import {
  buildTimelineItems,
  deleteItems,
  setLaneState,
  splitAt,
  splitNoopMessage,
  timebaseFor,
  trimItem,
  videoLaneSegments,
  type OpCtx,
} from '@/lib/clips/editor/clip-timeline'
import { buildCaptionWords } from '@/lib/clips/caption-words'
import { editorPreviewEdits } from '@/lib/clips/editor-preview-edits'
import { defaultEdits, editsPayloadForSave, mergeEditsPatch, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
// 0.6 s per word with 0.2 s pauses; a 1 s silence between w9 and w10 so "Tighten dead air" cuts.
const words = Array.from({ length: 24 }, (_, i) => {
  const s = i * 0.6 + (i >= 10 ? 0.8 : 0)
  return { i, w: `w${i}`, s, e: s + 0.4 }
})

function base(patch: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return { ...normalizeEdits(defaultEdits(bounds), bounds), loopFriendlyEnd: false, ...patch }
}
const ctxOf = (edits: ClipEditsV2): OpCtx => ({ edits, previewEdits: editorPreviewEdits(edits, words) })

describe('E2fix: Video-lane split model', () => {
  it('split with no selection adds a real Video segment (before: invisible layout boundary)', () => {
    const e = base({ cutRanges: [[3000, 4000]] })
    expect(buildTimelineItems({ edits: e, previewEdits: e }).video).toHaveLength(2)
    const next = splitAt(ctxOf(e), [], 1900)!
    expect(next).toBeTruthy()
    expect(next.videoSplits).toEqual([1900])
    const vids = buildTimelineItems({ edits: next, previewEdits: next }).video
    expect(vids.map((v) => [v.startMs, v.endMs])).toEqual([
      [0, 1900],
      [1900, 3000],
      [3000, 19000],
    ])
    // output timing is unchanged by a split
    expect(timebaseFor(next).durationMs).toBe(timebaseFor(e).durationMs)
  })

  it('with "Tighten dead air" on: splits at the OUTPUT playhead (source = output + removed silence)', () => {
    const e = base({ silenceTrim: { enabled: true, minGapMs: 350, keepMs: 120 } })
    const ctx = ctxOf(e)
    const tb = timebaseFor(ctx.previewEdits)
    expect(tb.segs.length).toBeGreaterThan(1) // silence trim made several keep segments
    const at = tb.starts[1]! + 300 // 300 ms into the 2nd segment (output)
    const next = splitAt(ctx, [], at)!
    expect(next.videoSplits).toEqual([tb.segs[1]![0] + 300])
    const n0 = buildTimelineItems({ edits: e, previewEdits: ctx.previewEdits }).video.length
    expect(buildTimelineItems({ edits: next, previewEdits: ctxOf(next).previewEdits }).video).toHaveLength(n0 + 1)
  })

  it('a selected Video segment splits only when the playhead is inside it; edges ±200 ms are no-ops', () => {
    const e = base({ cutRanges: [[3000, 4000]] })
    expect(splitAt(ctxOf(e), [{ lane: 'video', id: 'seg:0' }], 1900)?.videoSplits).toEqual([1900])
    expect(splitAt(ctxOf(e), [{ lane: 'video', id: 'seg:4000' }], 1900)).toBeNull()
    expect(splitAt(ctxOf(e), [], 2900)).toBeNull()
  })

  it('Delete on the right half becomes a cut: transcript/captions ripple; the left half stays', () => {
    const e = base()
    const split = splitAt(ctxOf(e), [], 3000)!
    const right = buildTimelineItems({ edits: split, previewEdits: split }).video[1]!
    expect(right.id).toBe('seg:3000')
    const del = deleteItems(ctxOf(split), [{ lane: 'video', id: right.id }])!
    expect(del.cutRanges).toEqual([[3000, 20000]])
    const caps = buildCaptionWords(words, del)
    expect(caps.every((c) => c.e_ms <= 3000)).toBe(true)
    expect(caps.length).toBe(words.filter((w) => w.e <= 3).length)
  })

  it('an inner split edge trims its own side without eating the sibling', () => {
    const split = splitAt(ctxOf(base()), [], 5000)!
    // extend the LEFT half's end past the split → no-op (sibling is a neighbour)
    expect(trimItem(ctxOf(split), { lane: 'video', id: 'seg:0' }, 'end', 6000)).toBeNull()
    // shrink the RIGHT half's start → a cut [5000, 5500]
    expect(trimItem(ctxOf(split), { lane: 'video', id: 'seg:5000' }, 'start', 5500)!.cutRanges).toEqual([[5000, 5500]])
  })

  it('locked Video lane: no split, and a toast message says why', () => {
    const e = setLaneState(base(), 'video', { locked: true })
    expect(splitAt(ctxOf(e), [], 3000)).toBeNull()
    expect(splitNoopMessage(e, [])).toMatch(/Video lane is locked/)
    expect(splitNoopMessage(base(), [])).toMatch(/Nothing to split/)
  })

  it('videoSplits persist through save (PATCH merge + normalize) and clear with null', () => {
    const split = splitAt(ctxOf(base()), [], 5000)!
    const saved = mergeEditsPatch(base(), editsPayloadForSave(split), bounds)
    expect(saved.videoSplits).toEqual([5000])
    const cleared = mergeEditsPatch(saved, editsPayloadForSave({ ...saved, videoSplits: undefined }), bounds)
    expect(cleared.videoSplits).toBeUndefined()
    expect(normalizeEdits({ ...base(), videoSplits: [9000, 0, 9000.4, 'x', 50000] }, bounds).videoSplits).toEqual([9000])
    const tb = timebaseFor(base())
    expect(videoLaneSegments(tb, [100, 5000])).toHaveLength(2) // 100 ms from the edge is ignored
  })
})

function Harness() {
  const st = useEditorState('clip_e2fix_split', bounds, base({ broll: [{ id: 'b1', source: 'stock', assetId: 'a', startMs: 1000, endMs: 2500 }] }))
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
      <output data-testid="cuts">{JSON.stringify(st.edits.cutRanges)}</output>
      <button type="button" data-testid="outside">outside</button>
    </>
  )
}

describe('E2fix: S / Split button on the Video lane (rendered, with useEditorState)', () => {
  afterEach(() => {
    cleanup()
    toastMessage.mockReset()
  })

  it('S (focus outside the timeline) splits; Delete on the right half cuts it; undo restores both steps', () => {
    const r = render(<Harness />)
    const videos = () => r.getAllByTestId('timeline-item-video')
    expect(videos()).toHaveLength(1)
    r.getByTestId('outside').focus()
    act(() => {
      fireEvent.keyDown(r.getByTestId('outside'), { key: 's' })
    })
    expect(videos()).toHaveLength(2)
    expect(videos()[1]!.getAttribute('data-start-ms')).toBe('3000')
    act(() => {
      fireEvent.pointerDown(videos()[1]!, { button: 0, clientX: 10 })
      fireEvent.pointerUp(window, { clientX: 10 })
    })
    act(() => {
      fireEvent.keyDown(r.getByTestId('timeline-scroll'), { key: 'Delete' })
    })
    expect(r.getByTestId('cuts').textContent).toBe('[[3000,20000]]')
    expect(videos()).toHaveLength(1)
    act(() => {
      fireEvent.keyDown(r.getByTestId('timeline-scroll'), { key: 'z', ctrlKey: true })
    })
    expect(r.getByTestId('cuts').textContent).toBe('[]')
    expect(videos()).toHaveLength(2)
    act(() => {
      fireEvent.keyDown(r.getByTestId('timeline-scroll'), { key: 'z', ctrlKey: true })
    })
    expect(videos()).toHaveLength(1)
  })

  it('the toolbar Split button splits the Video segment under the playhead', () => {
    const r = render(<Harness />)
    act(() => {
      fireEvent.click(r.getByTestId('timeline-split'))
    })
    expect(r.getAllByTestId('timeline-item-video')).toHaveLength(2)
  })

  it('S typed into a text field does not split', () => {
    const r = render(
      <>
        <Harness />
        <input data-testid="field" />
      </>,
    )
    act(() => {
      fireEvent.keyDown(r.getByTestId('field'), { key: 's' })
    })
    expect(r.getAllByTestId('timeline-item-video')).toHaveLength(1)
  })

  it('a split that cannot happen shows a toast instead of doing nothing silently', () => {
    const onCommitEdits = vi.fn()
    const r = render(
      <Timeline
        edits={base()}
        words={words}
        shots={[]}
        outputMs={50}
        clipOutputDurationMs={20000}
        onSeekOutput={() => {}}
        clipStartMs={0}
        clipEndMs={20000}
        onCommitEdits={onCommitEdits}
      />,
    )
    fireEvent.click(r.getByTestId('timeline-split'))
    expect(onCommitEdits).not.toHaveBeenCalled()
    expect(toastMessage).toHaveBeenCalledWith(expect.stringMatching(/Nothing to split/))
  })
})
