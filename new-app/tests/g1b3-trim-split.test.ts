import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits, orderedKeepSegments, type ClipEditsV2 } from '@/lib/clips/edits'
import { buildTimelineItems, rippleAnchoredItems, timebaseFor, trimItem } from '@/lib/clips/editor/clip-timeline'
import {
  audioSegments,
  normalizeSplitEdits,
  remapSplitEdits,
  splitAudioSrcAt,
  splitOffsets,
  splitPlanFor,
} from '@/lib/clips/editor/split-edits'
import { rollEdit, rollMainEdit, slideEdit, slideMainNeedsMiddleSegment, splitEdgeTrim } from '@/lib/clips/editor/trim-tools'
import { editorPreviewEdits } from '@/lib/clips/editor-preview-edits'
import type { BrollItem } from '@/lib/clips/broll'

const bounds = { clipStartMs: 0, clipEndMs: 10000 }
const base = (): ClipEditsV2 => normalizeEdits(defaultEdits(bounds), bounds)
const ctx = (e: ClipEditsV2) => ({ edits: e, previewEdits: e })
const br = (id: string, a: number, b: number, inMs = 0): BrollItem => ({ id, source: 'stock', assetId: id, startMs: a, endMs: b, inMs })
// keeps [0,3000] [4000,7000] [8000,10000]
const cut3 = (): ClipEditsV2 => ({ ...base(), cutRanges: [[3000, 4000], [7000, 8000]] })

describe('G1b3 split edits (J / L)', () => {
  it('normalizes, clamps and only applies at real cuts', () => {
    expect(normalizeSplitEdits([{ atMs: 4000, audioMs: 0 }, { atMs: 'x' }])).toBeUndefined()
    expect(normalizeSplitEdits([{ atMs: 4000.4, audioMs: 99999 }])).toEqual([{ atMs: 4000, audioMs: 10000 }])
    const segs = orderedKeepSegments(cut3())
    // L-cut 500 at 4000; |a| ≤ (min(3000,3000) − 100)/2 = 1450
    expect(splitOffsets(segs, [{ atMs: 4000, audioMs: 500 }], 0, 10000)).toEqual([0, 500, 0, 0])
    expect(splitOffsets(segs, [{ atMs: 4000, audioMs: 5000 }], 0, 10000)[1]).toBe(1450)
    expect(splitOffsets(segs, [{ atMs: 8000, audioMs: -400 }], 0, 10000)).toEqual([0, 0, -400, 0])
    expect(audioSegments(segs, [0, 500, -400, 0])).toEqual([[0, 3500], [4500, 6600], [7600, 10000]])
  })

  it('preview: alternate sound source inside the window only', () => {
    const e = { ...cut3(), splitEdits: [{ atMs: 4000, audioMs: 500 }, { atMs: 8000, audioMs: -400 }] }
    const plan = splitPlanFor(e, orderedKeepSegments(e))
    expect(splitAudioSrcAt(plan, 2999)).toBeNull()
    expect(splitAudioSrcAt(plan, 3000)).toBe(3000) // picture at 4000, sound continues at 3000
    expect(splitAudioSrcAt(plan, 3499)).toBe(3499)
    expect(splitAudioSrcAt(plan, 3500)).toBeNull()
    expect(splitAudioSrcAt(plan, 5600)).toBe(7600) // J: next clip's sound 400 early
    expect(splitAudioSrcAt(plan, 6000)).toBeNull()
  })

  it('Alt-drag the Voice edge sets the offset; Voice piece drawn at the sound', () => {
    const e = splitEdgeTrim(ctx(cut3()), { lane: 'voice', id: 'voice:0' }, 'end', 3600)!
    expect(e.splitEdits).toEqual([{ atMs: 4000, audioMs: 600 }])
    const v = buildTimelineItems({ edits: e, previewEdits: e }).voice
    expect([v[0]!.endMs, v[1]!.startMs, v[1]!.srcInMs]).toEqual([3600, 3600, 4600])
    // Alt-drag the Video edge = picture-only roll: picture cut +300, sound stays at 3600.
    const r = splitEdgeTrim(ctx(e), { lane: 'video', id: 'seg:4000' }, 'start', 3300)!
    expect(orderedKeepSegments(r)).toEqual([[0, 3300], [4300, 7000], [8000, 10000]])
    expect(r.splitEdits).toEqual([{ atMs: 4300, audioMs: 300 }])
  })

  it('plain Voice edge drag = linked trim; split key follows the cut', () => {
    const e = { ...cut3(), splitEdits: [{ atMs: 4000, audioMs: 500 }] }
    const t = trimItem(ctx(e), { lane: 'voice', id: 'voice:4000' }, 'start', 3700)! // drawn at 3500 → +200
    const r = rippleAnchoredItems(e, t, e, t)
    expect(orderedKeepSegments(r)[1]).toEqual([4200, 7000])
    expect(r.splitEdits).toEqual([{ atMs: 4200, audioMs: 500 }])
    expect(remapSplitEdits(e.splitEdits, [[0, 3000], [4000, 7000]], [[0, 3000]])).toBeUndefined()
  })
})

describe('G1b3 roll / slide', () => {
  it('slide on contiguous videoSplits moves both split points (middle clip)', () => {
    const e = { ...base(), videoSplits: [3333, 6666] }
    const s = slideEdit(ctx(e), { lane: 'video', id: 'seg:3333' }, 400)!
    expect(s.videoSplits).toEqual([3733, 7066])
    expect(timebaseFor(s).durationMs).toBe(timebaseFor(e).durationMs)
  })

  it('main roll keeps the length; slide moves the clip content-unchanged', () => {
    const e = cut3()
    const r = rollMainEdit(ctx(e), 4000, 500)!
    expect(orderedKeepSegments(r)).toEqual([[0, 3500], [4500, 7000], [8000, 10000]])
    expect(timebaseFor(r).durationMs).toBe(timebaseFor(e).durationMs)
    expect(rollEdit(ctx(e), { lane: 'video', id: 'seg:0' }, 'end', -5000)).not.toBeNull() // clamped
    const s = slideEdit(ctx(e), { lane: 'video', id: 'seg:4000' }, 400)!
    expect(orderedKeepSegments(s)).toEqual([[0, 3400], [4000, 7000], [8400, 10000]])
    // gap1 is only 1000 → slide capped at +1000
    expect(orderedKeepSegments(slideEdit(ctx(e), { lane: 'video', id: 'seg:4000' }, 5000)!)[0]).toEqual([0, 7000]) // gap closed → merged
    expect(slideEdit(ctx(e), { lane: 'video', id: 'seg:0' }, 100)).toBeNull()
  })

  it('roll at a videoSplit moves the split point', () => {
    const e = { ...base(), videoSplits: [5000] }
    expect(rollMainEdit(ctx(e), 5000, 700)!.videoSplits).toEqual([5700])
  })

  it('main roll / slide use committed keeps (preview silence-trim must not block roll at a split)', () => {
    const words = Array.from({ length: 40 }, (_, i) => ({ i, w: `w${i}`, s: i * 0.9, e: i * 0.9 + 0.3 }))
    const e = {
      ...base(),
      videoSplits: [5000],
      silenceTrim: { enabled: true, minGapMs: 350, keepMs: 120, fillerTrim: true, protectReactionGaps: false },
    }
    const preview = editorPreviewEdits(e, words)
    const op = { edits: e, previewEdits: preview }
    expect(rollMainEdit(op, 5000, 400)!.videoSplits).toEqual([5400])
    expect(slideMainNeedsMiddleSegment(op, { lane: 'video', id: 'seg:0' })).toBe(true)
  })

  it('overlay roll / slide on one track', () => {
    const e = { ...base(), broll: [br('a', 0, 2000), br('b', 2000, 4000, 100), br('c', 4000, 6000)] }
    const r = rollEdit(ctx(e), { lane: 'broll', id: 'a' }, 'end', 300)!
    expect(r.broll!.map((b) => [b.startMs, b.endMs, b.inMs])).toEqual([[0, 2300, 0], [2300, 4000, 400], [4000, 6000, 0]])
    // c.inMs = 0 → sliding left would need c's media before 0
    expect(slideEdit(ctx(e), { lane: 'broll', id: 'b' }, -500)).toBeNull()
    const s = slideEdit(ctx(e), { lane: 'broll', id: 'b' }, 300)!
    expect(s.broll!.map((b) => [b.startMs, b.endMs, b.inMs])).toEqual([[0, 2300, 0], [2300, 4300, 100], [4300, 6000, 300]])
  })
})
