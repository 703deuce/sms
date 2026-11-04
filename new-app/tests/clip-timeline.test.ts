import { describe, expect, it } from 'vitest'
import {
  applyTimelineLaneState,
  brollMediaForItems,
  buildTimelineItems,
  deleteItems,
  moveItems,
  musicWindow,
  outputToSource,
  rippleAnchoredItems,
  setLaneState,
  snapMoveDelta,
  snapTargets,
  snapValue,
  sourceToOutput,
  sourceToOutputSnapped,
  splitAt,
  timebaseFor,
  trimItem,
  type OpCtx,
} from '@/lib/clips/editor/clip-timeline'
import { defaultEdits, editsPayloadForSave, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'

const bounds = { clipStartMs: 0, clipEndMs: 10000, trimMinMs: 0, trimMaxMs: 20000 }

function base(patch: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return { ...normalizeEdits(defaultEdits(bounds), bounds), loopFriendlyEnd: false, ...patch }
}

const ctxOf = (edits: ClipEditsV2): OpCtx => ({ edits, previewEdits: edits })

describe('time base (output ms of the effective EDL)', () => {
  const e = base({ cutRanges: [[3000, 4000]] })
  const tb = timebaseFor(e)
  it('maps output ↔ source across a cut', () => {
    expect(tb.durationMs).toBe(9000)
    expect(outputToSource(tb, 2500)).toBe(2500)
    expect(outputToSource(tb, 3000)).toBe(4000)
    expect(sourceToOutput(tb, 5000)).toBe(4000)
    expect(sourceToOutput(tb, 3500)).toBeNull()
    expect(sourceToOutputSnapped(tb, 3500)).toBe(3000)
  })
  it('follows section order', () => {
    const r = base({ trim: { in: 0, out: 9000 }, sectionOrder: [[6000, 9000], [0, 6000]] })
    const t = timebaseFor(r)
    expect(t.segs[0]).toEqual([6000, 9000])
    expect(outputToSource(t, 0)).toBe(6000)
    expect(sourceToOutput(t, 0)).toBe(3000)
  })
})

describe('lanes', () => {
  it('builds video segments, B-roll, music window, SFX and hook items on one time base', () => {
    const e = base({
      cutRanges: [[3000, 4000]],
      broll: [{ id: 'b1', source: 'stock', assetId: 'a', startMs: 4000, endMs: 6000 }],
      audio: { music: { generationId: 'm', startMs: 1000 }, sfx: [{ generationId: 's', atMs: 3000 }] },
      hookOverlay: { enabled: true, text: 'Hi', durationMs: 2500 },
    })
    const lanes = buildTimelineItems({ edits: e, previewEdits: e, sfxDurationsMs: { s: 700 } })
    expect(lanes.video.map((v) => [v.startMs, v.endMs])).toEqual([
      [0, 3000],
      [3000, 9000],
    ])
    expect(lanes.voice).toHaveLength(2)
    // B-roll bars are OUTPUT ms (the old timeline drew them on the source span → offset after cuts)
    expect(lanes.broll[0]).toMatchObject({ startMs: 4000, endMs: 6000 })
    expect(lanes.music[0]).toMatchObject({ startMs: 1000, endMs: 9000, inMs: 0 })
    expect(lanes.sfx[0]).toMatchObject({ startMs: 3000, endMs: 3700 })
    expect(lanes.text[0]).toMatchObject({ startMs: 0, endMs: 2500, label: 'Hi' })
  })
  it('music window clamps to the clip', () => {
    expect(musicWindow({ generationId: 'm', startMs: 9900, endMs: 99999 }, 8000)).toEqual({
      startMs: 7500,
      endMs: 8000,
      inMs: 0,
    })
  })
  it('extends music end to clip tail when within fadeOut (AU-33)', () => {
    expect(musicWindow({ generationId: 'm', startMs: 0, endMs: 38700, fadeOutMs: 3000 }, 41000)).toEqual({
      startMs: 0,
      endMs: 41000,
      inMs: 0,
    })
  })
})

describe('operations map onto the edits model', () => {
  const withBroll = base({
    broll: [
      { id: 'b1', source: 'stock', assetId: 'a', startMs: 1000, endMs: 3000 },
      { id: 'b2', source: 'ai', generationId: 'g', startMs: 5000, endMs: 7000 },
    ],
    audio: { music: { generationId: 'm' }, sfx: [{ generationId: 's', atMs: 2000 }] },
  })

  it('moves a multi-selection by one shared, clamped delta', () => {
    const next = moveItems(
      ctxOf(withBroll),
      [
        { lane: 'broll', id: 'b1' },
        { lane: 'sfx', id: 's' },
      ],
      -1500,
    )!
    // b1 can only move -1000 (start hits 0) → the whole selection moves -1000
    expect(next.broll![0]).toMatchObject({ startMs: 0, endMs: 2000 })
    expect(next.audio!.sfx[0]!.atMs).toBe(1000)
    expect(next.broll![1]).toMatchObject({ startMs: 5000 })
  })

  it('left-trim keeps B-roll content anchored via inMs', () => {
    const next = trimItem(ctxOf(withBroll), { lane: 'broll', id: 'b1' }, 'start', 1600)!
    expect(next.broll![0]).toMatchObject({ startMs: 1600, endMs: 3000, inMs: 600 })
    // cannot reveal media before 0
    const back = trimItem(ctxOf(next), { lane: 'broll', id: 'b1' }, 'start', 0)!
    expect(back.broll![0]).toMatchObject({ startMs: 1000, inMs: 0 })
  })

  it('trims and moves the music bed window', () => {
    const t = trimItem(ctxOf(withBroll), { lane: 'music', id: 'm' }, 'start', 2000)!
    expect(t.audio!.music).toMatchObject({ startMs: 2000, inMs: 2000 })
    const e = trimItem(ctxOf(t), { lane: 'music', id: 'm' }, 'end', 6000)!
    expect(e.audio!.music).toMatchObject({ startMs: 2000, endMs: 6000 })
    const m = moveItems(ctxOf(e), [{ lane: 'music', id: 'm' }], 1000)!
    expect(m.audio!.music).toMatchObject({ startMs: 3000, endMs: 7000, inMs: 2000 })
  })

  it('splits B-roll at the playhead into two items with continuous media', () => {
    const next = splitAt(ctxOf(withBroll), [{ lane: 'broll', id: 'b2' }], 6000)!
    const parts = next.broll!.filter((b) => b.id.startsWith('b2'))
    expect(parts).toHaveLength(2)
    expect(parts[0]).toMatchObject({ id: 'b2', startMs: 5000, endMs: 6000 })
    expect(parts[1]).toMatchObject({ startMs: 6000, endMs: 7000, inMs: 1000 })
    expect(parts[1]!.id).toBe('b2~6000')
  })

  it('split without a selection splits the main video (layout boundary)', () => {
    const next = splitAt(ctxOf(withBroll), [], 4000)!
    expect(next.layout.layoutSegments?.length).toBeGreaterThanOrEqual(2)
    expect(next.layout.layoutSegments!.some((s) => s.startMs === 4000 || s.endMs === 4000)).toBe(true)
  })

  it('deletes items; a video segment becomes a cut range; the last segment is kept', () => {
    const e = base({ cutRanges: [[3000, 4000]] })
    const next = deleteItems(ctxOf(e), [{ lane: 'video', id: 'seg:0' }])!
    expect(next.cutRanges).toEqual([[0, 4000]])
    const both = deleteItems(ctxOf(e), [
      { lane: 'video', id: 'seg:0' },
      { lane: 'video', id: 'seg:4000' },
    ])!
    expect(timebaseFor(both).durationMs).toBeGreaterThan(0)
    const d = deleteItems(ctxOf(withBroll), [
      { lane: 'broll', id: 'b1' },
      { lane: 'music', id: 'm' },
      { lane: 'sfx', id: 's' },
    ])!
    expect(d.broll!.map((b) => b.id)).toEqual(['b2'])
    expect(d.audio!.music).toBeNull()
    expect(d.audio!.sfx).toEqual([])
  })

  it('video edge trims edit cuts and trim (never creates a new model)', () => {
    const e = base({ cutRanges: [[3000, 4000]] })
    // shrink seg 2 start by 500 → cut grows
    const s = trimItem(ctxOf(e), { lane: 'video', id: 'seg:4000' }, 'start', 3500)!
    expect(s.cutRanges).toEqual([[3000, 4500]])
    // extend seg 1 end into the cut → cut shrinks (restore)
    const r = trimItem(ctxOf(e), { lane: 'video', id: 'seg:0' }, 'end', 3400)!
    expect(r.cutRanges).toEqual([[3400, 4000]])
    // clip in-point → trim.in
    const tin = trimItem(ctxOf(e), { lane: 'video', id: 'seg:0' }, 'start', 800)!
    expect(tin.trim.in).toBe(800)
    // clip out-point → trim.out and loop-friendly trim off (WYSIWYG)
    const tout = trimItem({ ...ctxOf(e), edits: { ...e, loopFriendlyEnd: undefined } }, { lane: 'video', id: 'seg:4000' }, 'end', 8000)!
    expect(tout.trim.out).toBe(9000)
    expect(tout.loopFriendlyEnd).toBe(false)
  })

  it('magnet off: main-video start trim also inserts a gap (TIMELINE_LAYOUT1)', () => {
    const e = base({ cutRanges: [[3000, 4000]] })
    const s = trimItem({ ...ctxOf(e), magnet: false }, { lane: 'video', id: 'seg:4000' }, 'start', 3500)!
    expect(s.cutRanges).toEqual([[3000, 4500]])
    expect(s.inserts?.length).toBe(1)
    expect(s.inserts![0]!.durMs).toBe(500)
  })

  it('locked lanes are not editable', () => {
    const locked = setLaneState(withBroll, 'broll', { locked: true })
    expect(moveItems(ctxOf(locked), [{ lane: 'broll', id: 'b1' }], 500)).toBeNull()
    expect(deleteItems(ctxOf(locked), [{ lane: 'broll', id: 'b1' }])).toBeNull()
  })
})

describe('snapping', () => {
  it('snaps to playhead, cut joins, words and other item edges within the threshold', () => {
    const e = base({
      cutRanges: [[3000, 4000]],
      broll: [{ id: 'b1', source: 'stock', assetId: 'a', startMs: 5000, endMs: 6000 }],
    })
    const lanes = buildTimelineItems({ edits: e, previewEdits: e })
    const targets = snapTargets({ lanes, durationMs: 9000, playheadMs: 1234, wordEdgesMs: [2222] })
    expect(targets).toEqual(expect.arrayContaining([0, 1234, 2222, 3000, 5000, 6000, 9000]))
    expect(snapValue(1250, targets, 40)).toEqual({ ms: 1234, snappedTo: 1234 })
    expect(snapValue(1400, targets, 40).snappedTo).toBeNull()
    // moving [5000,6000] by +2980 → end edge 8980 snaps to 9000
    expect(snapMoveDelta([5000, 6000], 2980, targets.filter((t) => t !== 5000 && t !== 6000), 40)).toEqual({
      deltaMs: 3000,
      snappedTo: 9000,
    })
  })
})

describe('ripple keeps anchored items on their source content after transcript cuts', () => {
  it('B-roll and SFX after a new cut shift left by the cut length', () => {
    const prev = base({
      broll: [{ id: 'b1', source: 'stock', assetId: 'a', startMs: 5000, endMs: 7000 }],
      audio: { music: null, sfx: [{ generationId: 's', atMs: 6000 }] },
    })
    const next = { ...prev, cutRanges: [[1000, 2000]] as [number, number][] }
    const r = rippleAnchoredItems(prev, next, prev, next)
    expect(r.broll![0]).toMatchObject({ startMs: 4000, endMs: 6000 })
    expect(r.audio!.sfx[0]!.atMs).toBe(5000)
  })
  it('does not ripple when the anchored items themselves changed', () => {
    const prev = base({ broll: [{ id: 'b1', source: 'stock', assetId: 'a', startMs: 5000, endMs: 7000 }] })
    const next = { ...prev, cutRanges: [[1000, 2000]] as [number, number][], broll: [] }
    expect(rippleAnchoredItems(prev, next, prev, next)).toBe(next)
  })
  it('an item whose content was cut collapses to the join with the minimum length', () => {
    const prev = base({ broll: [{ id: 'b1', source: 'stock', assetId: 'a', startMs: 2000, endMs: 3000 }] })
    const next = { ...prev, cutRanges: [[1500, 3500]] as [number, number][] }
    const r = rippleAnchoredItems(prev, next, prev, next)
    expect(r.broll![0]).toMatchObject({ startMs: 1500, endMs: 2500 })
  })
})

describe('lane state + schema', () => {
  it('normalizeEdits keeps timelineLanes, B-roll inMs and the music window', () => {
    const raw = {
      ...base(),
      timelineLanes: { broll: { hidden: true }, video: { muted: true } },
      broll: [{ id: 'b', source: 'stock', assetId: 'a', startMs: 1000, endMs: 3000, inMs: 250 }],
      audio: { music: { generationId: 'm', startMs: 500, endMs: 4000, inMs: 100 }, sfx: [] },
    }
    const n = normalizeEdits(raw, bounds)
    expect(n.timelineLanes).toEqual({ broll: { hidden: true } })
    expect(n.broll![0]!.inMs).toBe(250)
    expect(n.audio!.music).toMatchObject({ startMs: 500, endMs: 4000, inMs: 100 })
  })
  it('clearing all lane toggles is sent as null so the server copy is cleared', () => {
    expect(editsPayloadForSave(base()).timelineLanes).toBeNull()
  })
  it('applyTimelineLaneState drops hidden/muted lanes', () => {
    const e = setLaneState(
      setLaneState(
        base({
          broll: [{ id: 'b', source: 'stock', assetId: 'a', startMs: 1000, endMs: 3000 }],
          audio: { music: { generationId: 'm' }, sfx: [{ generationId: 's', atMs: 1 }] },
        }),
        'broll',
        { hidden: true },
      ),
      'sfx',
      { muted: true },
    )
    const r = applyTimelineLaneState(e)
    expect(r.broll).toEqual([])
    expect(r.audio!.sfx).toEqual([])
    expect(r.audio!.music).not.toBeNull()
  })
  it('split B-roll items reuse the original media row for preview', () => {
    const rows = [{ id: 'b2', assetId: undefined, generationId: 'g', url: 'u' }]
    const out = brollMediaForItems(
      [
        { id: 'b2', source: 'ai', generationId: 'g', startMs: 0, endMs: 1000 },
        { id: 'b2~1000', source: 'ai', generationId: 'g', startMs: 1000, endMs: 2000, inMs: 1000 },
      ],
      rows,
    )
    expect(out.map((r) => r.id)).toEqual(['b2', 'b2~1000'])
  })
})
