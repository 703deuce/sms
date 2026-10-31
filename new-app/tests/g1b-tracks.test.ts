import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { defaultEdits, editsPayloadForSave, isDefaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import {
  addTrack,
  applyTrackState,
  effectiveTracks,
  layerOrder,
  moveTrack,
  normalizeTracks,
  removeTrack,
  renameTrack,
  setItemsTrack,
  setTrackFlags,
  trackIdOf,
  trackMoves,
  underPasses,
  underTextIds,
} from '@/lib/clips/editor/tracks'
import { applyTimelineLaneState, buildTimelineItems, refLocked, setLaneState, splitAt, timelineRows } from '@/lib/clips/editor/clip-timeline'
import { orderedStack } from '@/lib/clips/editor/layer-props'
import { reconcileItemMotion } from '@/lib/clips/editor/keyframes'
import { buildTextItemsAss } from '@/lib/clips/render-plan/text-items-ass'
import type { BrollItem } from '@/lib/clips/broll'
import type { TextItem } from '@/lib/clips/editor/text-items'

const bounds = { clipStartMs: 0, clipEndMs: 10000 }
const base = (): ClipEditsV2 => normalizeEdits(defaultEdits(bounds), bounds)
const br = (id: string, a: number, b: number): BrollItem => ({ id, source: 'stock', assetId: 'a' + id, startMs: a, endMs: b })
const tx = (id: string, a: number, b: number): TextItem => ({
  id,
  text: id,
  startMs: a,
  endMs: b,
  x: 50,
  y: 50,
  style: { font: 'Montserrat', size: 96, color: '#ffffff', align: 'center', case: 'none' } as TextItem['style'],
})

describe('G1b tracks model', () => {
  it('defaults: nothing saved, every item on its default track', () => {
    const e = base()
    expect(normalizeTracks(undefined)).toBeUndefined()
    expect(normalizeTracks([{ id: 'ov1', kind: 'overlay' }, { id: 'tx1', kind: 'text' }, { id: 'au1', kind: 'audio' }])).toBeUndefined()
    expect(effectiveTracks(e).map((t) => t.id)).toEqual(['ov1', 'tx1', 'au1'])
    expect(trackIdOf(e, 'overlay', 'x')).toBe('ov1')
    expect(isDefaultEdits(e, bounds)).toBe(true)
    expect(editsPayloadForSave(e).tracks).toBeNull()
  })

  it('normalize: drops bad rows, restores defaults, first claim wins, flags only on extra tracks', () => {
    const n = normalizeTracks([
      { id: 'tx2', kind: 'text', name: '  Lower   thirds ', items: ['a', 'a', 'b'], hidden: true, muted: true },
      { id: 'tx1', kind: 'overlay' },
      { id: 'bad id', kind: 'text' },
      { id: 'ov2', kind: 'overlay', items: ['b1'], locked: true },
      { id: 'au2', kind: 'audio', muted: true, hidden: true, items: ['s1'] },
      { id: 'tx3', kind: 'text', items: ['b'] },
    ])!
    expect(n.map((t) => t.id)).toEqual(['ov1', 'tx2', 'ov2', 'au2', 'tx3', 'tx1', 'au1'])
    expect(n[1]).toEqual({ id: 'tx2', kind: 'text', name: 'Lower thirds', items: ['a', 'b'], hidden: true })
    expect(n[4]!.items).toBeUndefined()
    expect(n[3]).toEqual({ id: 'au2', kind: 'audio', muted: true, items: ['s1'] })
  })

  it('add / rename / move / remove tracks; items follow', () => {
    let e: ClipEditsV2 = { ...base(), broll: [br('b1', 0, 3000), br('b2', 1000, 4000)], textItems: [tx('t1', 0, 2000)] }
    const r = addTrack(e, 'overlay')!
    expect(r.trackId).toBe('ov2')
    e = r.edits
    expect(effectiveTracks(e).map((t) => t.id)).toEqual(['ov1', 'tx1', 'ov2', 'au1'])
    e = setItemsTrack(e, 'overlay', ['b2'], 'ov2')!
    expect(trackIdOf(e, 'overlay', 'b2')).toBe('ov2')
    expect(trackMoves(e, 'ov2')).toEqual({ up: false, down: true })
    e = moveTrack(e, 'ov2', 'down')!
    expect(effectiveTracks(e).filter((t) => t.kind !== 'audio').map((t) => t.id)).toEqual(['ov1', 'ov2', 'tx1'])
    e = renameTrack(e, 'ov2', 'PiP')!
    expect(timelineRows(e).map((x) => x.label)).toEqual(['Text', 'PiP', 'B-roll', 'Video', 'Voice', 'Music', 'SFX'])
    expect(timelineRows(e).map((x) => x.key)).toEqual(['text', 'broll:ov2', 'broll', 'video', 'voice', 'music', 'sfx'])
    const gone = removeTrack(e, 'ov2')!
    expect(gone.broll!.map((b) => b.id)).toEqual(['b1'])
    expect(gone.tracks).toBeUndefined()
    expect(removeTrack(e, 'ov1')).toBeNull()
  })

  it('hidden / muted / locked per track; default track = the E2 lane toggles', () => {
    let e: ClipEditsV2 = { ...base(), broll: [br('b1', 0, 3000), br('b2', 1000, 4000)] }
    e = addTrack(e, 'overlay')!.edits
    e = setItemsTrack(e, 'overlay', ['b2'], 'ov2')!
    expect(applyTrackState(setTrackFlags(e, 'ov2', { hidden: true })!).broll!.map((b) => b.id)).toEqual(['b1'])
    // Lane hide now only hides the default track's items.
    expect(applyTimelineLaneState(setLaneState(e, 'broll', { hidden: true })).broll!.map((b) => b.id)).toEqual(['b2'])
    const locked = setTrackFlags(e, 'ov2', { locked: true })!
    expect(refLocked(locked, { lane: 'broll', id: 'b2' })).toBe(true)
    expect(refLocked(locked, { lane: 'broll', id: 'b1' })).toBe(false)
  })

  it('layer order: track first, then G1a z', () => {
    let e: ClipEditsV2 = { ...base(), broll: [br('b1', 0, 3000), br('b2', 1000, 4000), br('b3', 500, 2000)] }
    e = addTrack(e, 'overlay')!.edits
    e = setItemsTrack(e, 'overlay', ['b1'], 'ov2')!
    expect(orderedStack(e, 'broll', e.broll!).map((b) => b.id)).toEqual(['b3', 'b2', 'b1'])
    expect(layerOrder(base(), 'overlay', [br('x', 0, 10), br('y', 0, 10)], () => 0).map((b) => b.id)).toEqual(['x', 'y'])
  })

  it('split children inherit their track; deleted items leave the track list', () => {
    let e: ClipEditsV2 = { ...base(), broll: [br('b1', 0, 4000)] }
    e = addTrack(e, 'overlay')!.edits
    e = setItemsTrack(e, 'overlay', ['b1'], 'ov2')!
    const pe = e
    const split = splitAt({ edits: e, previewEdits: pe }, [{ lane: 'broll', id: 'b1' }], 2000)!
    const rec = reconcileItemMotion(e, split)
    const kid = rec.broll!.find((b) => b.id !== 'b1')!
    expect(trackIdOf(rec, 'overlay', kid.id)).toBe('ov2')
    const del = reconcileItemMotion(rec, { ...rec, broll: rec.broll!.filter((b) => b.id === kid.id) })
    expect(effectiveTracks(del).find((t) => t.id === 'ov2')!.items).toEqual([kid.id])
  })

  it('under text: text tracks below the top used overlay track', () => {
    let e: ClipEditsV2 = { ...base(), broll: [br('b1', 0, 3000)], textItems: [tx('t1', 0, 2000), tx('t2', 0, 2000)] }
    expect(underTextIds(e, ['b1'])).toEqual([])
    e = addTrack(e, 'text')!.edits // tx2 on top
    e = setItemsTrack(e, 'text', ['t2'], 'tx2')!
    e = moveTrack(e, 'tx1', 'down')! // tx1 under ov1
    expect(effectiveTracks(e).filter((t) => t.kind !== 'audio').map((t) => t.id)).toEqual(['tx1', 'ov1', 'tx2'])
    expect(underTextIds(e, ['b1'])).toEqual(['t1'])
    expect(underTextIds(e, [])).toEqual([])
    expect(underPasses(e, ['b1'])).toEqual([
      { kind: 'text', trackId: 'tx1', ids: ['t1'] },
      { kind: 'overlay', trackId: 'ov1', ids: ['b1'] },
    ])
  })

  it('text ASS: one track = E4/G1a bytes; several tracks stack by track', () => {
    let e: ClipEditsV2 = { ...base(), textItems: [tx('t1', 0, 2000), tx('t2', 0, 2000)] }
    const plain = buildTextItemsAss(e as unknown as Record<string, unknown>, 1080, 1920)!
    expect(plain).toContain('Dialogue: 1,')
    e = addTrack(e, 'text')!.edits
    e = setItemsTrack(e, 'text', ['t1'], 'tx2')!
    const multi = buildTextItemsAss(e as unknown as Record<string, unknown>, 1080, 1920)!
    // t2 (tx1, bottom) first on layer 1, t1 (tx2, top) second on layer 3.
    const ev = multi.split('\n').filter((l) => l.startsWith('Dialogue:'))
    expect(ev[0]).toMatch(/^Dialogue: 1,.*,T0,/)
    expect(ev[ev.length - 1]).toMatch(/^Dialogue: 3,.*,T1,.*t1/)
  })

  it('timeline items carry their track; rows filter by track', () => {
    let e: ClipEditsV2 = { ...base(), broll: [br('b1', 0, 3000), br('b2', 1000, 4000)] }
    e = addTrack(e, 'overlay')!.edits
    e = setItemsTrack(e, 'overlay', ['b2'], 'ov2')!
    const lanes = buildTimelineItems({ edits: e, previewEdits: e })
    expect(lanes.broll.map((i) => [i.id, i.track])).toEqual([
      ['b1', 'ov1'],
      ['b2', 'ov2'],
    ])
  })

  it('parity fixture (shared with pytest)', () => {
    const fx = JSON.parse(readFileSync(path.join(__dirname, '../../worker/tests/fixtures/g1b_tracks_parity.json'), 'utf8'))
    for (const c of fx.normalize) expect(normalizeTracks(c.raw) ?? null).toEqual(c.out)
    for (const c of fx.under) {
      expect(underTextIds(c.edits, c.overlayIds)).toEqual(c.ids)
      expect(underPasses(c.edits, c.overlayIds)).toEqual(c.passes)
    }
    for (const c of fx.state) {
      const out = applyTimelineLaneState(c.edits as ClipEditsV2)
      expect({ broll: (out.broll ?? []).map((b) => b.id), text: (out.textItems ?? []).map((t) => t.id), sfx: (out.audio?.sfx ?? []).map((s) => s.generationId) }).toEqual(c.out)
    }
  })
})
