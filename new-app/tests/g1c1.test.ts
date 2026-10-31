import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { defaultEdits, editsPayloadForSave, isDefaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { normalizeAudioEdits as normalizeClipAudio } from '@/lib/clips/audio'
import {
  COMP_KNEE_DB,
  hasFx,
  integratedLufs,
  lufsGainDb,
  normalizeTrackFx,
  trackFxFor,
  WEB_HP_Q_DB,
  webAudioPlan,
  webAutoMakeupDb,
  withTrackFx,
} from '@/lib/clips/editor/track-fx'
import { applyTrackColor } from '@/lib/clips/editor/track-render'
import { applyTimelineLaneState, timebaseFor } from '@/lib/clips/editor/clip-timeline'
import { fixAllPacing, fixPacingFlag, pacingFlags } from '@/lib/clips/editor/pacing'
import { canSplitStereo, splitStereoToTracks } from '@/lib/clips/editor/timeline-edit-ops'
import { trackIdOf } from '@/lib/clips/editor/tracks'
import { TrackFxPanel } from '@/components/clips/editor/timeline/track-fx-panel'

const here = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.resolve(here, '../../worker/tests/fixtures/g1c_parity.json')
const bounds = { clipStartMs: 0, clipEndMs: 10000 }
const base = (): ClipEditsV2 => normalizeEdits(defaultEdits(bounds), bounds)

describe('G1c track FX parity fixture (worker track_fx.py asserts the same)', () => {
  const fx = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'))
  it('normalize', () => {
    for (const c of fx.fx_cases) expect(normalizeTrackFx(c.raw) ?? []).toEqual(c.out)
  })
  it('LUFS gain', () => {
    for (const c of fx.gain_cases) expect(lufsGainDb(c.measured, c.target)).toEqual(c.gain)
  })
  it('overlay track color', () => {
    for (const c of fx.color_cases) {
      const e = normalizeEdits({ ...defaultEdits(bounds), ...c.edits }, bounds)
      expect(applyTrackColor(e).color?.broll ?? {}).toEqual(c.color_broll)
      // Also through the shared derivation the preview and the worker both run.
      expect(applyTimelineLaneState(e).color?.broll ?? {}).toEqual(c.color_broll)
    }
  })
})

describe('G1c track FX model', () => {
  it('round-trips through normalizeEdits / save payload; empty = default', () => {
    const e0 = base()
    const e = { ...e0, trackFx: withTrackFx(undefined, 'voice', { nr: 12, lufs: -16 }) }
    expect(isDefaultEdits(e, bounds)).toBe(false)
    const back = normalizeEdits(editsPayloadForSave(e) as unknown, bounds)
    expect(trackFxFor(back, 'voice')).toEqual({ track: 'voice', nr: 12, lufs: -16 })
    const cleared = { ...back, trackFx: withTrackFx(back.trackFx, 'voice', null) }
    expect(cleared.trackFx).toBeUndefined()
    expect(isDefaultEdits(cleared, bounds)).toBe(true)
  })
  it('drops FX for tracks that do not exist (au/ov), keeps voice / music', () => {
    const e = normalizeEdits({ ...defaultEdits(bounds), trackFx: [{ track: 'au7', nr: 9 }, { track: 'music', limit: -2 }, { track: 'au1', nr: 8 }] }, bounds)
    expect(e.trackFx?.map((f) => f.track)).toEqual(['au1', 'music'])
  })
  it('Web Audio plan mirrors the ffmpeg chain (knee centred, auto make-up cancelled)', () => {
    const plan = webAudioPlan(
      { track: 'voice', eq: { hp: 80, low: 2, mid: -3, midHz: 2500, high: 4 }, comp: { threshold: -20, ratio: 4, attack: 10, release: 150, makeup: 2 }, lufs: -16, limit: -1 },
      3.5,
    )
    expect(plan.map((n) => n.type + (n.type === 'biquad' ? ':' + n.kind : ''))).toEqual([
      'biquad:highpass', 'biquad:lowshelf', 'biquad:peaking', 'biquad:highshelf', 'comp', 'gain', 'gain', 'comp', 'gain',
    ])
    expect(WEB_HP_Q_DB).toBeCloseTo(-3.0103, 4)
    expect(plan[4]).toMatchObject({ threshold: -20 - COMP_KNEE_DB / 2, knee: COMP_KNEE_DB, ratio: 4, attack: 0.01, release: 0.15 })
    expect(webAutoMakeupDb(-20, 4)).toBeCloseTo(9, 6)
    expect((plan[5] as { db: number }).db).toBeCloseTo(2 - 9, 2)
    expect(plan[6]).toEqual({ type: 'gain', db: 3.5 })
    expect(webAudioPlan({ track: 'voice', bypass: true, nr: 10 })).toEqual([])
    expect(webAudioPlan({ track: 'voice', lufs: -16, limit: -1 }, 2, 'pre')).toEqual([])
  })
  it('BS.1770 integrated loudness: 997 Hz full-scale sine = −3.01 LUFS; silence = null; −20 dB = −23.01', () => {
    const fs = 48000
    const n = fs * 3
    const s = new Float32Array(n)
    for (let i = 0; i < n; i++) s[i] = Math.sin((2 * Math.PI * 997 * i) / fs)
    expect(integratedLufs([s], fs)!).toBeCloseTo(-3.01, 1)
    expect(integratedLufs([s.map((v) => v * 0.1)], fs)!).toBeCloseTo(-23.01, 1)
    expect(integratedLufs([new Float32Array(n)], fs)).toBeNull()
  })
  it('panel renders audio + overlay variants', () => {
    const a = renderToStaticMarkup(createElement(TrackFxPanel, { fxKey: 'au1', label: 'Audio 1', fx: { track: 'au1', nr: 12, lufs: -16 }, onChange: () => {}, onClose: () => {} }))
    expect(a).toContain('track-fx-panel-au1')
    expect(a).toContain('track-fx-lufs')
    const o = renderToStaticMarkup(createElement(TrackFxPanel, { fxKey: 'ov1', label: 'Overlay 1', fx: undefined, onChange: () => {}, onClose: () => {} }))
    expect(o).toContain('track-fx-panel-ov1')
    expect(o).not.toContain('track-fx-lufs')
    expect(hasFx(undefined)).toBe(false)
  })
})

describe('G1c split stereo to L/R tracks', () => {
  const withSfx = (): ClipEditsV2 => ({
    ...base(),
    audio: normalizeClipAudio({ music: null, sfx: [{ generationId: 'upl_1', uploadId: 'upl_1', atMs: 1000, volume: 0.8, inMs: 250, durMs: 2000 }] }),
    keyframes: [{ target: 'sfx:upl_1', prop: 'volume', points: [{ tMs: 0, v: 100 }, { tMs: 1000, v: 50 }] }],
  })
  it('SFX upload → two mono items on two new audio tracks, envelope copied', () => {
    const e = withSfx()
    expect(canSplitStereo(e, 'sfx', 'upl_1')).toBe(true)
    const r = splitStereoToTracks(e, 'sfx', 'upl_1')!
    const sfx = r.edits.audio!.sfx
    expect(sfx.map((c) => [c.generationId, c.channel, c.atMs, c.inMs, c.durMs, c.volume])).toEqual([
      ['upl_1~1', 'L', 1000, 250, 2000, 0.8],
      ['upl_1~2', 'R', 1000, 250, 2000, 0.8],
    ])
    expect(trackIdOf(r.edits, 'audio', 'upl_1~1')).toBe(r.trackIds[0])
    expect(trackIdOf(r.edits, 'audio', 'upl_1~2')).toBe(r.trackIds[1])
    expect(r.edits.tracks!.find((t) => t.id === r.trackIds[0])!.name).toMatch(/ L$/)
    expect(r.edits.keyframes!.filter((k) => k.target.startsWith('sfx:')).map((k) => k.target).sort()).toEqual(['sfx:upl_1~1', 'sfx:upl_1~2'])
    // Channel survives save / load; a split item can't be split again.
    const back = normalizeEdits(editsPayloadForSave(r.edits) as unknown, bounds)
    expect(back.audio!.sfx.map((c) => c.channel)).toEqual(['L', 'R'])
    expect(canSplitStereo(back, 'sfx', 'upl_1~1')).toBe(false)
  })
  it('B-roll upload → its sound split, picture kept', () => {
    const e: ClipEditsV2 = { ...base(), broll: [{ id: 'u', source: 'upload', uploadId: 'upl_2', startMs: 500, endMs: 2500, inMs: 100 }] }
    const r = splitStereoToTracks(e, 'broll', 'u')!
    expect(r.edits.broll).toHaveLength(1)
    expect(r.edits.audio!.sfx.map((c) => [c.generationId, c.channel, c.atMs, c.inMs, c.durMs])).toEqual([
      ['upl_2~1', 'L', 500, 100, 2000],
      ['upl_2~2', 'R', 500, 100, 2000],
    ])
  })
  it('not for AI SFX / main video', () => {
    const e: ClipEditsV2 = { ...base(), audio: normalizeClipAudio({ music: null, sfx: [{ generationId: 'gen1', atMs: 0, volume: 1 }] }) }
    expect(canSplitStereo(e, 'sfx', 'gen1')).toBe(false)
    expect(canSplitStereo(e, 'video', 'x')).toBe(false)
  })
})

describe('G1c pacing checker', () => {
  const e0 = (): ClipEditsV2 => ({
    ...base(),
    // The engine drops cuts / pieces under 80 ms, so real slivers / jumps are 80–100 ms (≤ 3 frames):
    // a 90 ms jump at 3000; a 90 ms sliver 5100–5190; trailing cut to 6000.
    cutRanges: [[3000, 3090], [5000, 5100], [5190, 6000]],
    broll: [
      { id: 'b1', source: 'stock', assetId: 'a1', startMs: 6000, endMs: 7000 },
      { id: 'b2', source: 'stock', assetId: 'a2', startMs: 7050, endMs: 8000 },
    ],
  })
  const s = { staticMaxS: 2, sliverFrames: 3, gapFrames: 3 }
  it('flags slivers, micro jumps, overlay holes and static stretches', () => {
    const e = e0()
    const flags = pacingFlags(e, timebaseFor(e), s)
    const kinds = flags.map((f) => `${f.kind}:${f.fix?.type ?? '-'}`)
    expect(kinds).toContain('sliver:cutSource')
    expect(kinds).toContain('gap:restoreSource')
    expect(kinds).toContain('gap:closeGap')
    expect(flags.some((f) => f.kind === 'static' && f.startMs === 0 && f.endMs === 3000)).toBe(true)
    const sl = flags.find((f) => f.kind === 'sliver')!
    expect(sl.label).toBe('3-frame sliver')
    expect(sl.fix).toEqual({ type: 'cutSource', range: [5100, 5190] })
  })
  it('one-click fixes', () => {
    const e = e0()
    const flags = pacingFlags(e, timebaseFor(e), s)
    const cut = fixPacingFlag(e, flags.find((f) => f.kind === 'sliver')!)!
    expect(cut.cutRanges).toEqual([[3000, 3090], [5000, 6000]])
    const rest = fixPacingFlag(e, flags.find((f) => f.fix?.type === 'restoreSource')!)!
    expect(rest.cutRanges).toEqual([[5000, 5100], [5190, 6000]])
    const hole = fixPacingFlag(e, flags.find((f) => f.fix?.type === 'closeGap')!)!
    expect(hole.broll!.find((b) => b.id === 'b1')!.endMs).toBe(7050)
    const all = fixAllPacing(e, flags)!
    const left = pacingFlags(all, timebaseFor(all), s).filter((f) => f.fix)
    expect(left).toEqual([])
    expect(fixPacingFlag(e, flags.find((f) => f.kind === 'static')!)).toBeNull()
  })
  it('a picture change (B-roll / main keyframe) breaks a static stretch', () => {
    const e: ClipEditsV2 = { ...base(), broll: [{ id: 'b', source: 'stock', assetId: 'a', startMs: 4000, endMs: 5000 }] }
    const st = pacingFlags(e, timebaseFor(e), { ...s, staticMaxS: 4.5 }).filter((f) => f.kind === 'static')
    expect(st.map((f) => [f.startMs, f.endMs])).toEqual([[5000, 10000]])
  })
})
