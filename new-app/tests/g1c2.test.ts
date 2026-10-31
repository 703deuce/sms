import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { defaultEdits, editsPayloadForSave, isDefaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { applyTimelineLaneState, buildTimelineItems, timebaseFor } from '@/lib/clips/editor/clip-timeline'
import { applyTrackRender } from '@/lib/clips/editor/track-render'
import {
  cycleBrollTake,
  cycleMainTake,
  groupBrollTakes,
  groupMainTakes,
  inactiveBrollTakeIds,
  takeGroupAtSource,
  takesFromRetakes,
  ungroupTakes,
} from '@/lib/clips/editor/takes'
import { applyMainPreset, presetKeys, presetValues, setTrackMotionValue, withTrackMotion } from '@/lib/clips/editor/track-motion'
import { insertFromSource, matchFrameAt, overwriteFromSource, transcriptLines, wordRangeMs } from '@/lib/clips/editor/source-monitor'
import type { ProjectMediaItem } from '@/lib/clips/editor/media-add'
import { timelineCommandFor } from '@/lib/clips/editor/timeline-shortcuts'
import { TrackMotionPanel } from '@/components/clips/editor/timeline/track-motion-panel'
import type { BrollItem } from '@/lib/clips/broll'

const here = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.resolve(here, '../../worker/tests/fixtures/g1c2_parity.json')
const bounds = { clipStartMs: 0, clipEndMs: 10000 }
const base = (): ClipEditsV2 => normalizeEdits(defaultEdits(bounds), bounds)
const br = (id: string, a: number, b: number, inMs?: number): BrollItem => ({ id, source: 'stock', assetId: 'a' + id, startMs: a, endMs: b, ...(inMs ? { inMs } : {}) })
const sortKf = (k: NonNullable<ClipEditsV2['keyframes']>) => [...k].filter((x) => x.target.startsWith('broll:')).sort((a, b) => (a.target + a.prop < b.target + b.prop ? -1 : 1))

describe('G1c2 parity fixture (worker takes.py / track_motion.py assert the same)', () => {
  const fx = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'))
  it('takes', () => {
    for (const c of fx.take_cases) {
      const e = normalizeEdits({ ...defaultEdits(bounds), ...c.edits }, bounds)
      expect([...inactiveBrollTakeIds(e)].sort()).toEqual(c.inactive)
      expect((applyTrackRender(e).broll ?? []).map((b) => b.id)).toEqual(c.rendered)
    }
  })
  it('track motion bake', () => {
    for (const c of fx.motion_cases) {
      const e = normalizeEdits({ ...defaultEdits(bounds), ...c.edits }, bounds)
      const out = applyTrackRender(e)
      expect(sortKf(out.keyframes ?? [])).toEqual(c.baked)
      expect(out.trackMotion != null).toBe(c.has_track_motion_after)
    }
  })
})

describe('G1c2 takes', () => {
  it('B-roll: group → only the active take renders and shows; T cycles into the same slot', () => {
    const e0: ClipEditsV2 = { ...base(), broll: [br('a', 1000, 3000), br('b', 5000, 6500, 200), br('c', 7000, 8000)] }
    const g = groupBrollTakes(e0, ['a', 'b'])!
    expect(g.broll!.find((x) => x.id === 'b')).toMatchObject({ startMs: 1000, endMs: 3000, inMs: 200 })
    expect([...inactiveBrollTakeIds(g)]).toEqual(['b'])
    expect(applyTimelineLaneState(g).broll!.map((x) => x.id)).toEqual(['a', 'c'])
    const lanes = buildTimelineItems({ edits: g, previewEdits: g })
    expect(lanes.broll.map((i) => [i.id, i.label])).toEqual([
      ['a', 'Stock B-roll · Take 1/2'],
      ['c', 'Stock B-roll'],
    ])
    const r = cycleBrollTake(g, 'a', 1)!
    expect(r.active).toBe('b')
    expect(applyTimelineLaneState(r.edits).broll!.map((x) => x.id)).toEqual(['b', 'c'])
    // Survives save / load; deleting the active take promotes the next; ungroup shows all.
    const back = normalizeEdits(editsPayloadForSave(r.edits) as unknown, bounds)
    expect(back.takes).toEqual(r.edits.takes)
    expect(isDefaultEdits({ ...base(), takes: back.takes }, bounds)).toBe(false)
    const del = normalizeEdits({ ...back, broll: back.broll!.filter((x) => x.id !== 'b') }, bounds)
    expect(del.takes).toBeUndefined()
    expect(ungroupTakes(r.edits, r.edits.takes![0]!.id).takes).toBeUndefined()
  })
  it('main video: inactive readings are cut, the active one restored with its own cuts', () => {
    const e0: ClipEditsV2 = { ...base(), cutRanges: [[1200, 1400]] }
    const g = groupMainTakes(e0, [[1000, 2000], [3000, 4000], [5000, 6000]], 0)!
    expect(g.cutRanges).toEqual([[1200, 1400], [3000, 4000], [5000, 6000]])
    expect(takeGroupAtSource(g, 3500)?.id).toBe(g.takes![0]!.id)
    const n1 = cycleMainTake(g, g.takes![0]!.id, 1)!
    expect(n1.cutRanges).toEqual([[1000, 2000], [5000, 6000]])
    expect(n1.takes![0]).toMatchObject({ active: 1, saved: [[[1200, 1400]], [], []] })
    const n2 = cycleMainTake(cycleMainTake(n1, g.takes![0]!.id, 1)!, g.takes![0]!.id, 1)!
    expect(n2.cutRanges).toEqual(g.cutRanges)
    const lanes = buildTimelineItems({ edits: g, previewEdits: g })
    expect(lanes.video.some((i) => i.label.includes('Take 1/3'))).toBe(true)
    // Overlapping / tiny ranges are refused.
    expect(groupMainTakes(e0, [[1000, 2000], [1500, 2500]])).toBeNull()
  })
  it('retake finder hook: each flagged reading + the next one become a take group (later active)', () => {
    const words = [0, 1, 2, 3, 4, 5].map((i) => ({ s: 1 + i * 0.5, e: 1.4 + i * 0.5 }))
    const g = takesFromRetakes(base(), [{ startMs: 1000, endMs: 2400 }], words)
    expect(g.takes).toEqual([{ id: 'mt1', kind: 'main', ranges: [[1000, 2400], [2400, 3900]], active: 1 }])
    expect(g.cutRanges).toEqual([[1000, 2400]])
  })
  it('T / Shift+T / F shortcuts', () => {
    expect(timelineCommandFor({ key: 't' })).toBe('nextTake')
    expect(timelineCommandFor({ key: 'T', shiftKey: true })).toBe('prevTake')
    expect(timelineCommandFor({ key: 'f' })).toBe('matchFrame')
    expect(timelineCommandFor({ key: 'f', ctrlKey: true })).toBeNull()
  })
})

describe('G1c2 track motion', () => {
  const withTracks = (): ClipEditsV2 =>
    normalizeEdits(
      { ...defaultEdits(bounds), broll: [br('b1', 0, 2000), br('b2', 3000, 5000)], tracks: [{ id: 'ov1', kind: 'overlay' }, { id: 'ov2', kind: 'overlay', items: ['b2'] }] },
      bounds,
    )
  it('presets + main slot', () => {
    expect(presetValues('right_half')).toEqual({ x: 25, cropL: 25, cropR: 25 })
    expect(presetValues('pip_br')).toEqual({ x: 32, y: 32, scale: 30 })
    expect(presetValues('left_third')).toEqual({ x: -33.33, cropL: 33.33, cropR: 33.33 })
    const m = applyMainPreset(base(), 'left_half')
    expect(m.keyframes).toEqual([
      { target: 'video', prop: 'x', value: -25, points: [] },
      { target: 'video', prop: 'cropL', value: 25, points: [] },
      { target: 'video', prop: 'cropR', value: 25, points: [] },
    ])
    expect(applyMainPreset(m, 'full').keyframes).toBeUndefined()
  })
  it('applies to every item on the track only, is idempotent through the lane derivation, round-trips', () => {
    const e = { ...withTracks(), trackMotion: withTrackMotion(undefined, 'ov2', presetKeys('pip_br')) }
    const once = applyTimelineLaneState(e)
    expect(sortKf(once.keyframes ?? [])).toEqual([
      { target: 'broll:b2', prop: 'scale', value: 30, points: [] },
      { target: 'broll:b2', prop: 'x', value: 32, points: [] },
      { target: 'broll:b2', prop: 'y', value: 32, points: [] },
    ])
    expect(applyTimelineLaneState(once)).toEqual(once)
    const back = normalizeEdits(editsPayloadForSave(e) as unknown, bounds)
    expect(back.trackMotion).toEqual(e.trackMotion)
    expect(isDefaultEdits({ ...base(), trackMotion: back.trackMotion }, bounds)).toBe(false)
    // A removed track drops its motion on load.
    const gone = normalizeEdits({ ...back, tracks: undefined }, bounds)
    expect(gone.trackMotion).toBeUndefined()
  })
  it('keyframing at the playhead', () => {
    let k = setTrackMotionValue([], 'x', 10, null)
    expect(k).toEqual([{ prop: 'x', value: 10, points: [] }])
    k = setTrackMotionValue(k, 'x', -20, 1000)
    expect(k).toEqual([{ prop: 'x', points: [{ tMs: 1000, v: -20 }] }])
    k = setTrackMotionValue(k, 'x', 20, 3000)
    expect(k[0]!.points.map((p) => p.tMs)).toEqual([1000, 3000])
  })
  it('panel renders', () => {
    const h = renderToStaticMarkup(createElement(TrackMotionPanel, { trackId: 'ov2', label: 'Overlay 2', keys: presetKeys('right_half'), playheadMs: 0, onChange: () => {}, onMainPreset: () => {}, onClose: () => {} }))
    expect(h).toContain('track-motion-panel-ov2')
    expect(h).toContain('track-motion-preset-pip_br')
    expect(h).toContain('track-motion-main-left_half')
  })
})

describe('G1c2 source monitor: build from transcript + match frame', () => {
  const words = [
    { w: 'Hello', s: 1.0, e: 1.3 },
    { w: 'there.', s: 1.35, e: 1.7 },
    { w: 'Second', s: 3.0, e: 3.4 },
    { w: 'line', s: 3.45, e: 3.8 },
  ]
  const vid: ProjectMediaItem = { id: 'u1', ref: 'upload', refId: 'up1', mediaType: 'video', label: 'Guest cam', durationMs: 60000, width: 1920, height: 1080, url: 'https://x/v.mp4', syncMs: null, syncStatus: 'none' }
  const aud: ProjectMediaItem = { ...vid, id: 'u2', refId: 'up2', mediaType: 'audio', label: 'VO' }
  const main: ProjectMediaItem = { ...vid, id: 'm', ref: 'upload', refId: 'main1', isMain: true, label: 'Main' }
  it('lines + padded word ranges', () => {
    expect(transcriptLines(words).map((l) => [l.i0, l.i1, l.text])).toEqual([
      [0, 1, 'Hello there.'],
      [2, 3, 'Second line'],
    ])
    expect(wordRangeMs(words, 2, 3)).toEqual([2940, 3860])
    expect(wordRangeMs(words, 3, 2)).toEqual([2940, 3860])
    expect(wordRangeMs(words, 0, 9)).toBeNull()
  })
  it('Insert: video → ripple insert with the selection in-point; audio → audio item at the playhead', () => {
    const e = base()
    const tb = timebaseFor(e)
    const r = insertFromSource(e, vid, tb, 4000, [2940, 3860], () => 'ins1')
    expect(r.edits!.inserts).toEqual([{ id: 'ins1', sourceId: 'up1', atSrcMs: 4000, inMs: 2940, durMs: 920 }])
    const a = insertFromSource(e, aud, tb, 4000, [2940, 3860], () => 'x')
    expect(a.edits!.audio!.sfx).toEqual([{ generationId: 'up2', uploadId: 'up2', atMs: 4000, volume: expect.any(Number), inMs: 2940, durMs: 920 }])
    expect(insertFromSource(e, main, tb, 0, [0, 1000], () => 'x').edits).toBeNull()
  })
  it('Overwrite: Video lane from the playhead, continuing across a cut, own sound', () => {
    const e: ClipEditsV2 = { ...base(), cutRanges: [[2000, 3000]] }
    const tb = timebaseFor(e)
    let n = 0
    const r = overwriteFromSource(e, vid, tb, 1500, [10000, 11000], () => `s${++n}`)
    expect(r.edits!.sourceSegments!.map((s) => [s.startMs, s.endMs, s.inMs, s.audio])).toEqual([
      [1500, 2000, 10000, 'source'],
      [3000, 3500, 10500, 'source'],
    ])
    expect(overwriteFromSource(e, aud, tb, 0, [0, 1000], () => 'x').edits).toBeNull()
  })
  it('match frame: B-roll upload on top, else the Video-lane source, else main', () => {
    const items = [vid, main]
    const e: ClipEditsV2 = {
      ...base(),
      cutRanges: [[2000, 3000]],
      broll: [{ id: 'bu', source: 'upload', uploadId: 'up1', startMs: 500, endMs: 1500, inMs: 4000 }],
    }
    const tb = timebaseFor(e)
    expect(matchFrameAt(e, tb, 1000, items)).toEqual({ itemId: 'u1', mediaMs: 4500, via: 'broll' })
    expect(matchFrameAt(e, tb, 2500, items)).toEqual({ itemId: 'm', mediaMs: 3500, via: 'main' })
    const ow = overwriteFromSource(e, vid, tb, 1800, [10000, 11000], () => 'sx').edits!
    expect(matchFrameAt(ow, timebaseFor(ow), 1900, items)).toEqual({ itemId: 'u1', mediaMs: 10100, via: 'segment' })
    // Synced angle (no inMs): media ms = source ms + syncMs.
    const synced: ClipEditsV2 = {
      ...base(),
      sources: [{ id: 'up1', ref: 'upload', refId: 'up1', mediaType: 'video', syncMs: 250 }],
      sourceSegments: [{ id: 'a1', sourceId: 'up1', startMs: 0, endMs: 5000 }],
    }
    expect(matchFrameAt(synced, timebaseFor(synced), 1000, items)).toEqual({ itemId: 'u1', mediaMs: 1250, via: 'segment' })
  })
})
