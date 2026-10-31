import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits, orderedKeepSegments, type ClipEditsV2 } from '@/lib/clips/edits'
import { buildTimelineItems } from '@/lib/clips/editor/clip-timeline'
import { addTrack, setItemsTrack, setTrackFlags, trackIdOf } from '@/lib/clips/editor/tracks'
import {
  adjacentCutPoint,
  copyItems,
  cutItems,
  cutPoints,
  deleteRange,
  duplicateItems,
  moveItemsToTrack,
  moveVideoSegment,
  pasteAttributes,
  pasteItems,
} from '@/lib/clips/editor/timeline-edit-ops'
import type { BrollItem } from '@/lib/clips/broll'
import type { TextItem } from '@/lib/clips/editor/text-items'

const bounds = { clipStartMs: 0, clipEndMs: 10000 }
const base = (): ClipEditsV2 => normalizeEdits(defaultEdits(bounds), bounds)
const br = (id: string, a: number, b: number): BrollItem => ({ id, source: 'stock', assetId: 'a' + id, startMs: a, endMs: b })
const tx = (id: string, a: number, b: number, color = '#ffffff'): TextItem => ({
  id,
  text: id,
  startMs: a,
  endMs: b,
  x: 50,
  y: 50,
  style: { font: 'Montserrat', size: 96, color, align: 'center', case: 'none' } as TextItem['style'],
})
const ctx = (e: ClipEditsV2) => ({ edits: e, previewEdits: e })

describe('G1b clipboard', () => {
  it('copy + paste at the playhead keeps offsets, keyframes, flip, color and the track', () => {
    let e: ClipEditsV2 = {
      ...base(),
      broll: [br('b1', 1000, 3000)],
      textItems: [tx('t1', 1500, 2500)],
      keyframes: [{ target: 'broll:b1', prop: 'scale', points: [{ tMs: 0, v: 120 }] }],
      layerProps: [{ target: 'broll:b1', flipH: true }],
      color: { broll: { b1: { preset: 'warm' } as never } },
    }
    e = addTrack(e, 'overlay')!.edits
    e = setItemsTrack(e, 'overlay', ['b1'], 'ov2')!
    const clip = copyItems(e, [{ lane: 'broll', id: 'b1' }, { lane: 'text', id: 't1' }, { lane: 'video', id: 'seg:0' }])!
    expect(clip.entries).toHaveLength(2)
    const r = pasteItems(ctx(e), clip, 6000)!
    expect(r.refs.map((x) => x.lane)).toEqual(['broll', 'text'])
    const nb = r.edits.broll!.find((b) => b.id === r.refs[0]!.id)!
    const nt = r.edits.textItems!.find((t) => t.id === r.refs[1]!.id)!
    expect([nb.startMs, nb.endMs, nt.startMs, nt.endMs]).toEqual([6000, 8000, 6500, 7500])
    expect(r.edits.keyframes!.some((k) => k.target === `broll:${nb.id}` && k.points[0]!.v === 120)).toBe(true)
    expect(r.edits.layerProps!.some((p) => p.target === `broll:${nb.id}` && p.flipH)).toBe(true)
    expect(r.edits.color!.broll![nb.id]).toEqual({ preset: 'warm' })
    expect(trackIdOf(r.edits, 'overlay', nb.id)).toBe('ov2')
    expect(nb.id).not.toContain('~')
  })

  it('paste clamps to the end; locked source track → default track', () => {
    let e: ClipEditsV2 = { ...base(), broll: [br('b1', 0, 3000)] }
    e = addTrack(e, 'overlay')!.edits
    e = setItemsTrack(e, 'overlay', ['b1'], 'ov2')!
    const clip = copyItems(e, [{ lane: 'broll', id: 'b1' }])!
    const locked = setTrackFlags(e, 'ov2', { locked: true })!
    const r = pasteItems(ctx(locked), clip, 9500)!
    const nb = r.edits.broll!.find((b) => b.id === r.refs[0]!.id)!
    expect([nb.startMs, nb.endMs]).toEqual([7000, 10000])
    expect(trackIdOf(r.edits, 'overlay', nb.id)).toBe('ov1')
  })

  it('SFX: uploads paste as a new placement, generations are skipped', () => {
    const e: ClipEditsV2 = {
      ...base(),
      audio: { music: null, sfx: [{ generationId: 'up1', uploadId: 'up1', atMs: 100, volume: 1 }, { generationId: 'gen1', atMs: 200, volume: 1 }] },
    }
    const clip = copyItems(e, [{ lane: 'sfx', id: 'up1' }, { lane: 'sfx', id: 'gen1' }])!
    const r = pasteItems(ctx(e), clip, 5000)!
    expect(r.skipped).toBe(1)
    expect(r.edits.audio!.sfx.map((s) => [s.generationId, s.atMs])).toEqual([
      ['up1', 100],
      ['gen1', 200],
      ['up1~2', 5000],
    ])
  })

  it('cut deletes, duplicate lands right after, paste attributes copies the look', () => {
    const e: ClipEditsV2 = { ...base(), textItems: [tx('t1', 0, 1000, '#ff0000'), tx('t2', 3000, 4000)] }
    const c = cutItems(ctx(e), [{ lane: 'text', id: 't1' }])!
    expect(c.edits.textItems!.map((t) => t.id)).toEqual(['t2'])
    const d = duplicateItems(ctx(e), [{ lane: 'text', id: 't2' }])!
    const dup = d.edits.textItems!.find((t) => t.id === d.refs[0]!.id)!
    expect([dup.startMs, dup.endMs]).toEqual([4000, 5000])
    const pa = pasteAttributes(ctx(e), copyItems(e, [{ lane: 'text', id: 't1' }])!, [{ lane: 'text', id: 't2' }])!
    const t2 = pa.textItems!.find((t) => t.id === 't2')!
    expect(t2.style.color).toBe('#ff0000')
    expect([t2.startMs, t2.text]).toEqual([3000, 't2'])
  })

  it('move items to another track (drag between tracks)', () => {
    let e: ClipEditsV2 = { ...base(), broll: [br('b1', 0, 3000)], textItems: [tx('t1', 0, 1000)] }
    e = addTrack(e, 'overlay')!.edits
    const m = moveItemsToTrack(e, [{ lane: 'broll', id: 'b1' }, { lane: 'text', id: 't1' }], 'ov2')!
    expect(trackIdOf(m, 'overlay', 'b1')).toBe('ov2')
    expect(moveItemsToTrack(setTrackFlags(e, 'ov2', { locked: true })!, [{ lane: 'broll', id: 'b1' }], 'ov2')).toBeNull()
    const back = moveItemsToTrack(m, [{ lane: 'broll', id: 'b1' }], 'ov1')!
    expect(trackIdOf(back, 'overlay', 'b1')).toBe('ov1')
  })
})

describe('G1b main track', () => {
  it('drag a Video segment earlier → sectionOrder, gapless, content kept', () => {
    // Cuts at 2000-2500 and 6000-6400 → segments [0,2000] [2500,6000] [6400,10000].
    const e: ClipEditsV2 = { ...base(), cutRanges: [[2000, 2500], [6000, 6400]] }
    const m = moveVideoSegment(ctx(e), 'seg:6400', 'seg:0')!
    expect(orderedKeepSegments(m)).toEqual([
      [6400, 10000],
      [0, 2000],
      [2500, 6000],
    ])
    const back = moveVideoSegment(ctx(m), 'seg:6400', null)!
    expect(orderedKeepSegments(back)).toEqual([
      [0, 2000],
      [2500, 6000],
      [6400, 10000],
    ])
    expect(back.sectionOrder).toBeUndefined()
    expect(moveVideoSegment(ctx(e), 'seg:0', 'seg:2500')).toBeNull() // already there
  })

  it('splits (videoSplits) are movable pieces too', () => {
    const e: ClipEditsV2 = { ...base(), videoSplits: [4000] }
    const m = moveVideoSegment(ctx(e), 'seg:4000', 'seg:0')!
    expect(orderedKeepSegments(m)).toEqual([
      [4000, 10000],
      [0, 4000],
    ])
    const items = buildTimelineItems({ edits: m, previewEdits: m }).video
    expect(items.map((i) => i.id)).toEqual(['seg:4000', 'seg:0'])
  })

  it('in/out range delete ripples (cut ranges in source ms)', () => {
    const e: ClipEditsV2 = { ...base(), cutRanges: [[2000, 3000]] }
    const d = deleteRange(ctx(e), [1500, 2500])!
    expect(d.cutRanges).toEqual([[1500, 3500]])
    expect(deleteRange(ctx(e), [0, 9000])).toBeNull()
  })

  it('cut points for ↑/↓', () => {
    const e: ClipEditsV2 = { ...base(), broll: [br('b1', 1000, 3000)], videoSplits: [5000] }
    const pts = cutPoints(buildTimelineItems({ edits: e, previewEdits: e }), 10000)
    expect(pts).toEqual([0, 1000, 3000, 5000, 10000])
    expect(adjacentCutPoint(pts, 3000, 1)).toBe(5000)
    expect(adjacentCutPoint(pts, 3000, -1)).toBe(1000)
    expect(adjacentCutPoint(pts, 10000, 1)).toBeNull()
  })
})
