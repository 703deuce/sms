import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits, orderedKeepSegments, type ClipEditsV2 } from '@/lib/clips/edits'
import { buildTimelineItems, rippleAnchoredItems } from '@/lib/clips/editor/clip-timeline'
import { autoCrossfade } from '@/lib/clips/editor/auto-crossfade'
import { envelopeFor } from '@/lib/clips/editor/envelopes'
import { addFreezeFrame, insertWindows, normalizeInserts } from '@/lib/clips/editor/inserts'
import { placeAddedOnTrack } from '@/lib/clips/editor/media-add'
import { setAngleForRange } from '@/lib/clips/editor/multicam-manual'
import { applyMulticamSegments, normalizeSourceSegments, sourceSegmentAt } from '@/lib/clips/editor/sources'
import { deleteRange, detachBrollAudio } from '@/lib/clips/editor/timeline-edit-ops'
import { addTrack, setTrackFlags, trackIdOf } from '@/lib/clips/editor/tracks'
import { moveItems } from '@/lib/clips/editor/clip-timeline'
import type { BrollItem } from '@/lib/clips/broll'
import type { TextItem } from '@/lib/clips/editor/text-items'
import { normalizeAudioEdits } from '@/lib/clips/audio'

const bounds = { clipStartMs: 0, clipEndMs: 10000 }
const base = (): ClipEditsV2 => normalizeEdits(defaultEdits(bounds), bounds)
const ctx = (e: ClipEditsV2) => ({ edits: e, previewEdits: e })
const br = (id: string, a: number, b: number, inMs = 0): BrollItem => ({ id, source: 'stock', assetId: id, startMs: a, endMs: b, inMs })
const tx = (id: string, a: number, b: number): TextItem =>
  ({ id, text: id, startMs: a, endMs: b, x: 50, y: 50, style: { font: 'Montserrat', size: 96, color: '#fff', align: 'center', case: 'none' } }) as TextItem

describe('G1b3 range extract on every unlocked track', () => {
  it('main + B-roll split / delete / shift, text, SFX, music; locked tracks stay', () => {
    let e: ClipEditsV2 = {
      ...base(),
      broll: [br('in', 2200, 2800), br('span', 1000, 5000), br('after', 6000, 8000)],
      textItems: [tx('t', 2500, 4000)],
      audio: { music: { generationId: 'm', volume: 0.3, startMs: 500, endMs: 9000 } as never, sfx: [{ generationId: 's1', atMs: 2500 }, { generationId: 's2', atMs: 7000 }] },
      keyframes: [{ target: 'video', prop: 'scale', points: [{ tMs: 1000, v: 100 }, { tMs: 6000, v: 120 }] }],
    }
    e = addTrack(e, 'overlay')!.edits
    const lockedTrack = trackIdOf(e, 'overlay', 'x') === 'ov1' ? e.tracks!.find((t) => t.kind === 'overlay' && t.id !== 'ov1')!.id : 'ov2'
    e = { ...e, broll: [...e.broll!, br('lk', 6000, 7000)] }
    e = { ...e, tracks: e.tracks!.map((t) => (t.id === lockedTrack ? { ...t, items: ['lk'] } : t)) }
    e = setTrackFlags(e, lockedTrack, { locked: true }) ?? e
    const d = deleteRange(ctx(e), [2000, 3000])!
    expect(orderedKeepSegments(d)).toEqual([[0, 2000], [3000, 10000]])
    const b = Object.fromEntries(d.broll!.map((x) => [x.id, [x.startMs, x.endMs, x.inMs ?? 0]]))
    expect(b.in).toBeUndefined()
    expect(b.span).toEqual([1000, 2000, 0])
    const right = d.broll!.find((x) => x.id.startsWith('span~'))!
    expect([right.startMs, right.endMs, right.inMs]).toEqual([2000, 4000, 2000])
    expect(b.after).toEqual([5000, 7000, 0])
    expect(b.lk).toEqual([6000, 7000, 0]) // locked track keeps its time
    expect(d.textItems!.map((t) => [t.startMs, t.endMs])).toEqual([[2000, 3000]])
    expect(d.audio!.sfx.map((s) => [s.generationId, s.atMs])).toEqual([['s2', 6000]])
    expect([d.audio!.music!.startMs, d.audio!.music!.endMs]).toEqual([500, 8000])
    expect(d.keyframes![0]!.points.map((p) => p.tMs)).toEqual([1000, 5000])
    // The commit ripple must not map it a second time.
    const r = rippleAnchoredItems(e, d, e, d)
    expect(r.broll!.find((x) => x.id === 'after')!.startMs).toBe(5000)
  })
})

describe('G1b3 auto-crossfade', () => {
  it('B-roll dragged over another on the same track fades the top one in; undrag removes it', () => {
    const e: ClipEditsV2 = { ...base(), broll: [br('a', 0, 3000), br('b', 4000, 6000)] }
    const m = moveItems(ctx(e), [{ lane: 'broll', id: 'b' }], -1500)!
    const x = autoCrossfade(e, m, e, m, [{ lane: 'broll', id: 'b' }])
    const kb = x.keyframes!.find((k) => k.target === 'broll:b' && k.prop === 'opacity')!
    expect(kb.points).toEqual([{ tMs: 0, v: 0 }, { tMs: 500, v: 100 }])
    const back = moveItems(ctx(x), [{ lane: 'broll', id: 'b' }], 1500)!
    expect(autoCrossfade(x, back, x, back, [{ lane: 'broll', id: 'b' }]).keyframes).toBeUndefined()
  })

  it('SFX overlap: outgoing volume down, incoming up', () => {
    const e: ClipEditsV2 = { ...base(), audio: { music: null, sfx: [{ generationId: 'a', atMs: 0 }, { generationId: 'b', atMs: 3000 }] } }
    const dur = { a: 2000, b: 2000 }
    const m = moveItems(ctx(e), [{ lane: 'sfx', id: 'b' }], -1400)!
    const x = autoCrossfade(e, m, e, m, [{ lane: 'sfx', id: 'b' }], dur)
    expect(x.keyframes!.find((k) => k.target === 'sfx:a')!.points).toEqual([{ tMs: 1600, v: 100 }, { tMs: 2000, v: 0 }])
    expect(x.keyframes!.find((k) => k.target === 'sfx:b')!.points).toEqual([{ tMs: 0, v: 0 }, { tMs: 400, v: 100 }])
    expect(envelopeFor('sfx', 'a')).toEqual({ target: 'sfx:a', prop: 'volume' })
  })

  it('text overlap on the same track gets opacity crossfade keyframes (not main video)', () => {
    const e: ClipEditsV2 = { ...base(), textItems: [tx('a', 0, 3000), tx('b', 4000, 6000)] }
    const m = moveItems(ctx(e), [{ lane: 'text', id: 'b' }], -1500)!
    const x = autoCrossfade(e, m, e, m, [{ lane: 'text', id: 'b' }])
    const kb = x.keyframes!.find((k) => k.target === 'text:b' && k.prop === 'opacity')!
    expect(kb.points).toEqual([{ tMs: 0, v: 0 }, { tMs: 500, v: 100 }])
  })
})

describe('G1b3 freeze frame / main angle / drop on track / detach', () => {
  it('freeze insert needs no source, lengthens like an insert', () => {
    const segs: [number, number][] = [[0, 4000], [5000, 8000]]
    const ins = addFreezeFrame(undefined, segs, 4500, 'frz-1')!
    expect(ins[0]).toMatchObject({ sourceId: 'freeze', atSrcMs: 5500, durMs: 3000, audio: 'mute' })
    expect(normalizeInserts(ins, [])).toHaveLength(1)
    const w = insertWindows(segs, normalizeInserts(ins, []))
    expect(w[0]).toMatchObject({ baseMs: 4500, startMs: 4500, endMs: 7500, freeze: true })
    expect(addFreezeFrame(undefined, segs, 99999, 'f2')![0]!.append).toBe(true)
  })

  it('switch back to main is stored; a later auto-switch keeps it', () => {
    const src = { id: 'cam2', ref: 'take' as const, refId: 'cam2', mediaType: 'video' as const, syncMs: 0 }
    let e: ClipEditsV2 = { ...base(), sources: [src] }
    e = setAngleForRange(e, 0, 10000, 'cam2')
    e = setAngleForRange(e, 3000, 5000, 'main')
    expect(e.sourceSegments!.map((s) => [s.sourceId, s.startMs, s.endMs])).toEqual([['cam2', 0, 3000], ['main', 3000, 5000], ['cam2', 5000, 10000]])
    expect(sourceSegmentAt(e.sourceSegments, 4000)).toBeUndefined()
    const auto = applyMulticamSegments(e.sourceSegments, [{ id: 'g', sourceId: 'cam2', startMs: 0, endMs: 10000, auto: true }], 0, 10000, e.sources)!
    expect(auto.some((s) => s.sourceId === 'main' && s.startMs === 3000)).toBe(true)
    expect(auto.some((s) => s.auto && s.startMs < 5000 && s.endMs > 3000)).toBe(false)
    expect(normalizeSourceSegments([{ id: 'x', sourceId: 'main', startMs: 0, endMs: 1000, auto: true }], [])).toBeUndefined()
  })

  it('media dropped on an extra track row lands on it', () => {
    const e0 = addTrack(base(), 'overlay')!
    const prev = e0.edits
    const tid = prev.tracks!.find((t) => t.kind === 'overlay' && t.id !== 'ov1')!.id
    const next = { ...prev, broll: [br('new', 0, 2000)] }
    expect(trackIdOf(placeAddedOnTrack(prev, next, 'broll', tid), 'overlay', 'new')).toBe(tid)
    expect(placeAddedOnTrack(prev, next, 'broll', 'ov1')).toBe(next)
  })

  it('detach audio of an uploaded B-roll clip → SFX item with in-point and length', () => {
    const e: ClipEditsV2 = { ...base(), broll: [{ id: 'u', source: 'upload', uploadId: 'upl_1', startMs: 1000, endMs: 4000, inMs: 500 }] }
    const r = detachBrollAudio(e, 'u')!
    expect(r.edits.audio!.sfx[0]).toMatchObject({ generationId: 'upl_1', uploadId: 'upl_1', atMs: 1000, inMs: 500, durMs: 3000 })
    const n = normalizeAudioEdits(r.edits.audio)
    expect(n.sfx[0]).toMatchObject({ inMs: 500, durMs: 3000 })
    const lanes = buildTimelineItems({ edits: r.edits, previewEdits: r.edits, sfxDurationsMs: { upl_1: 10000 } })
    expect([lanes.sfx[0]!.startMs, lanes.sfx[0]!.endMs]).toEqual([1000, 4000])
    expect(detachBrollAudio(r.edits, 'u')!.id).toBe('upl_1~1')
  })
})
