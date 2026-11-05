import { describe, expect, it } from 'vitest'
import { defaultEdits, displayDurationMs, type ClipEditsV2 } from '@/lib/clips/edits'
import { buildTimelineItems, deleteItems, joinVideoSplits, timebaseFor, trimItem, videoJoinOptions } from '@/lib/clips/editor/clip-timeline'
import { copyItems, duplicateItems, pasteItems, insertCopiedMainVideo } from '@/lib/clips/editor/timeline-edit-ops'
import { exportTimeMap, speedBaseMs, speedDisplayMs } from '@/lib/clips/editor/export-time'
import { addTrack, setItemsTrack } from '@/lib/clips/editor/tracks'
import { autoCrossfadeOverlaps } from '@/lib/clips/editor/auto-crossfade'

const fresh = () => defaultEdits({ clipStartMs: 0, clipEndMs: 31_000 })
const op = (edits: ClipEditsV2) => ({ edits, previewEdits: edits })

describe('Full Editor Suite Batch 2 — real source duplication (F2)', () => {
  it('duplicates the 31s main clip to 62s without any worker-only edit field', () => {
    const edits = fresh()
    const copied = copyItems(edits, [{ lane: 'video', id: 'seg:0' }], edits)
    expect(copied?.entries).toMatchObject([{ kind: 'video', srcInMs: 0, srcOutMs: 31_000 }])
    const result = duplicateItems(op(edits), [{ lane: 'video', id: 'seg:0' }])
    expect(result).toBeTruthy()
    expect(timebaseFor(result!.edits).durationMs).toBe(62_000)
    expect(displayDurationMs(result!.edits)).toBe(62_000)
    // Copy and original are independent output segments even though the source is shared.
    const vids = buildTimelineItems(op(result!.edits)).video
    expect(vids.some(v => v.startMs >= 31_000 && v.srcInMs === 0)).toBe(true)
    expect(new Set(vids.map(v => v.id)).size).toBe(vids.length)
  })

  it('pastes main footage at an arbitrary playhead, including at output zero', () => {
    const edits = fresh()
    const clip = copyItems(edits, [{ lane: 'video', id: 'seg:0' }], edits)!
    for (const at of [0, 10_000, 31_000]) {
      const r = pasteItems(op(edits), clip, at)
      expect(r, `clipboard paste at ${at}`).toBeTruthy()
      expect(timebaseFor(r!.edits).durationMs).toBe(62_000)
    }
  })

  it('copies a selected split piece, not the whole source', () => {
    const edits = { ...fresh(), videoSplits: [10_000] }
    const clip = copyItems(edits, [{ lane: 'video', id: 'seg:10000' }], edits)
    expect(clip?.entries).toMatchObject([{ kind: 'video', srcInMs: 10_000, srcOutMs: 31_000 }])
    const r = pasteItems(op(edits), clip!, 3_000)
    expect(r).toBeTruthy()
    expect(timebaseFor(r!.edits).durationMs).toBe(52_000)
  })

  it('never invents an export-unsupported section order when the maximum is exceeded', () => {
    expect(insertCopiedMainVideo(fresh(), 0, [{ srcInMs: 0, srcOutMs: 150 }])).toBeNull()
  })
})

describe('Batch 2 — reversible source trim / Join (F3/F10)', () => {
  it('allows an outer edge to extend back to original duration after trimming', () => {
    const e = fresh()
    const shrink = trimItem(op(e), { lane: 'video', id: 'seg:0' }, 'end', 20_000)!
    expect(shrink.trim.out).toBe(20_000)
    const extended = trimItem(op(shrink), { lane: 'video', id: 'seg:0' }, 'end', 31_000)!
    expect(extended.trim.out).toBe(31_000)
  })

  it('joins two split pieces after reload without relying on undo', () => {
    const e = { ...fresh(), videoSplits: [10_000] }
    const joins = videoJoinOptions(op(e), [{ lane: 'video', id: 'seg:0' }])
    expect(joins.next).toBe(10_000)
    const joined = joinVideoSplits({ edits: e }, [joins.next!])!
    expect(joined.videoSplits).toEqual([])
    expect(buildTimelineItems(op(joined)).video).toHaveLength(1)
  })

  it('joins across a cut by restoring its source span', () => {
    const e = { ...fresh(), cutRanges: [[10_000, 11_000] as [number, number]] }
    const joins = videoJoinOptions(op(e), [{ lane: 'video', id: 'seg:0' }])
    expect(joins.next).toBe(11_000)
    const joined = joinVideoSplits({ edits: e }, [11_000])!
    expect(joined.cutRanges).toEqual([])
    expect(timebaseFor(joined).durationMs).toBe(31_000)
  })
})

describe('Batch 2 — output duration and speed coordinates (F20/F21)', () => {
  it('Magnet-off deletion replaces selected footage with equal duration of black/silence', () => {
    const e = { ...fresh(), videoSplits: [10_000] }
    const next = deleteItems({ ...op(e), magnet: false }, [{ lane: 'video', id: 'seg:0' }])!
    expect(next.inserts?.some(i => i.sourceId === 'gap')).toBe(true)
    // F20: a kept gap means the displayed length correctly stays unchanged.
    expect(displayDurationMs(next)).toBe(displayDurationMs(e))
  })

  it('1.5× globally compresses source time and ruler, while gaps stay full length', () => {
    const e = { ...fresh(), speed: 1.5, inserts: [
      { id: 'gap1', sourceId: 'gap', atSrcMs: 10_000, inMs: 0, durMs: 2_000, audio: 'mute' as const },
    ] }
    const map = exportTimeMap(timebaseFor(e).segs, e.inserts)
    expect(speedDisplayMs(map, 31_000, 1.5)).toBeCloseTo(31_000 / 1.5 + 2_000, 2)
    expect(speedDisplayMs(map, 5_000, 1.5)).toBeCloseTo(5_000 / 1.5, 2)
    expect(speedBaseMs(map, speedDisplayMs(map, 21_000, 1.5), 1.5, 31_000)).toBeCloseTo(21_000, 0)
    expect(speedBaseMs(map, 10_000 / 1.5 + 1_000, 1.5, 31_000)).toBeLessThanOrEqual(10_000)
    expect(displayDurationMs(e)).toBe(Math.round(31_000 / 1.5) + 2_000)
  })
})

describe('Batch 2 — optional cross-track fades (F37)', () => {
  it('does not affect one clip; reports a genuine overlap only when opted in', () => {
    const e = { ...fresh(), broll: [
      { id: 'b1', source: 'stock' as const, assetId: 'a1', startMs: 1_000, endMs: 6_000 },
      { id: 'b2', source: 'stock' as const, assetId: 'a2', startMs: 5_000, endMs: 9_000 },
    ] }
    const extra = addTrack(e, 'overlay')
    expect(extra).toBeTruthy()
    const withOther = setItemsTrack(extra!.edits, 'overlay', ['b2'], extra!.trackId)!
    expect(autoCrossfadeOverlaps(withOther, withOther, undefined, false)).toHaveLength(0)
    expect(autoCrossfadeOverlaps(withOther, withOther, undefined, true)).toMatchObject([
      { lane: 'broll', startMs: 5_000, endMs: 6_000 },
    ])
    const solo = { ...withOther, broll: withOther.broll?.slice(0, 1) }
    expect(autoCrossfadeOverlaps(solo, solo, undefined, true)).toHaveLength(0)
  })
})
