/**
 * G4c: scene detect, color match, fx keyframes, layerFx through split / duplicate / reverse,
 * stabilize / blur / smooth slow-mo normalizers (Python parity values from worker/tests/test_g4c.py),
 * plus the 8:55 PM steering fixes (focused-slider shortcuts, no-CORS hosts, list routes).
 */
import { describe, expect, it, vi } from 'vitest'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import type { BrollItem } from '@/lib/clips/broll'
import { detectCuts, frameSig, sampleTimes, sigDiff, usableCuts, type SceneSample } from '@/lib/clips/editor/scene-detect'
import { gradedStats, labStats, matchColor, statsDistance } from '@/lib/clips/editor/color-match'
import type { Rgb } from '@/lib/clips/editor/color-grade'
import { FX_KEY_QUANT, quantFx } from '@/lib/clips/editor/color-grade'
import { specWithOverrides } from '@/lib/clips/editor/grade-runtime'
import { reconcileLayerFx, reconcileLayerProps } from '@/lib/clips/editor/keyframes'
import { copyItems, duplicateItems, pasteItems } from '@/lib/clips/editor/timeline-edit-ops'
import { normalizeStabilize, setStabilize, stabilizeFor } from '@/lib/clips/editor/stabilize'
import { addBlurRegion, blurSigma, normalizeBlurRegions, patchBlurRegion } from '@/lib/clips/editor/blur-regions'
import { normalizeSmoothSlowmo, slowOutputS, smoothMode } from '@/lib/clips/editor/speed'
import { exportOnlyNote } from '@/lib/clips/editor/export-processing'
import { isFormControlTarget, isTextEntryTarget } from '@/lib/clips/editor/timeline-zoom'
import { corsKnown, corsState, isNoCorsHost } from '@/components/clips/editor/g4/grade-gl'
import { isSchemaMissingError, workspaceListResponse } from '@/lib/server/clips/list-route'

const bounds = { clipStartMs: 0, clipEndMs: 10000 }
const base = (): ClipEditsV2 => normalizeEdits(defaultEdits(bounds), bounds)
const br = (id: string, a: number, b: number, inMs?: number): BrollItem => ({ id, source: 'stock', assetId: 'a' + id, startMs: a, endMs: b, ...(inMs != null ? { inMs } : {}) })

function frame(w: number, h: number, rgb: (x: number, y: number) => [number, number, number]) {
  const px = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = rgb(x, y)
      const i = (y * w + x) * 4
      px[i] = r
      px[i + 1] = g
      px[i + 2] = b
      px[i + 3] = 255
    }
  return px
}

describe('G4c scene detect', () => {
  it('finds the hard cut, ignores slow drift, refuses cuts too close to edges / splits', () => {
    const samples: SceneSample[] = []
    for (let i = 0; i < 40; i++) {
      const t = i * 200
      const scene = t < 4000 ? (x: number, y: number) => [40 + i, 60, 200 - x] as [number, number, number] : (x: number, y: number) => [220, 180 - y, 30] as [number, number, number]
      samples.push({ t, sig: frameSig(frame(16, 16, scene), 16, 16) })
    }
    expect(sigDiff(samples[0]!.sig, samples[0]!.sig)).toBe(0)
    const cuts = detectCuts(samples)
    expect(cuts.length).toBe(1)
    expect(cuts[0]!.t).toBeGreaterThan(3800)
    expect(cuts[0]!.t).toBeLessThanOrEqual(4000)
    expect(usableCuts([4000, 200, 4100], [[0, 8000]], [], 500)).toEqual([4000])
    expect(usableCuts([4000], [[0, 8000]], [4300], 500)).toEqual([])
    expect(sampleTimes([[0, 1000]])).toEqual([0, 200, 400, 600, 800])
    expect(sampleTimes([[0, 3_000_000]]).length).toBeLessThanOrEqual(1500)
  })
})

describe('G4c color match', () => {
  it('recovers a known grade and writes visible Adjust values', () => {
    const px: Rgb[] = []
    for (let i = 0; i < 300; i++) px.push([((i * 37) % 255) / 255, ((i * 91) % 255) / 255, ((i * 13) % 255) / 255])
    const ref = gradedStats({ adjust: { exposure: 20, temperature: 15 } }, px)
    const r = matchColor({}, px, ref)
    expect(r.after).toBeLessThan(r.before * 0.3)
    expect(r.spec.adjust?.exposure ?? 0).toBeGreaterThan(5)
    expect(r.spec.adjust?.temperature ?? 0).toBeGreaterThan(0)
    for (const v of Object.values(r.spec.adjust ?? {})) expect(Number.isInteger(v)).toBe(true)
    expect(statsDistance(labStats(px), labStats(px))).toBe(0)
  })
})

describe('G4c fx keyframes', () => {
  it('quantizes like color_grade.quant_fx and leaves specs without fx tracks untouched', () => {
    expect(FX_KEY_QUANT).toBe(5)
    expect([0, 2.4, 2.5, 7.4, 7.5, 99, 120, -3].map(quantFx)).toEqual([0, 0, 5, 5, 10, 100, 100, 0])
    const tr = [{ target: 'video' as const, prop: 'fxVignette' as const, points: [{ tMs: 0, v: 0 }, { tMs: 1000, v: 50 }] }]
    expect(specWithOverrides({ fx: { grain: 10 } }, tr as never, 0)).toEqual({ fx: { grain: 10 } })
    expect(specWithOverrides({ fx: { grain: 10 } }, tr as never, 1000)).toEqual({ fx: { grain: 10, vignette: 50 } })
    const adj = [{ target: 'video' as const, prop: 'cExposure' as const, points: [{ tMs: 0, v: 10 }] }]
    expect(specWithOverrides({ fx: { grain: 0 } as never }, adj as never, 0)).toEqual({ fx: { grain: 0 }, adjust: { exposure: 10 } })
  })
})

describe('G4c layerFx follows split / duplicate / reverse', () => {
  const mask = { shape: 'rect' as const, x: 50, y: 50, w: 40, h: 40, rot: 0, feather: 10, keys: [{ ms: 0, x: 10, y: 50, w: 40, h: 40, rot: 0, feather: 10 }, { ms: 2000, x: 90, y: 50, w: 40, h: 40, rot: 0, feather: 10 }] }
  it('split child inherits the row with mask keys re-based (no jump)', () => {
    const prev = { ...base(), broll: [br('b1', 1000, 3000)], layerFx: [{ target: 'broll:b1', mask, blend: 'screen' as const }] }
    const next = { ...prev, broll: [br('b1', 1000, 2000), br('b1~2000', 2000, 3000, 1000)] }
    const out = reconcileLayerProps(prev, next)
    const child = out.layerFx!.find((r) => r.target === 'broll:b1~2000')!
    expect(child.blend).toBe('screen')
    expect(child.mask!.keys![0]).toMatchObject({ ms: 0, x: 50 })
    expect(child.mask!.keys![1]).toMatchObject({ ms: 1000, x: 90 })
  })
  it('reverse: the left half shows the end of the range, the right half the start', () => {
    const prev = { ...base(), broll: [br('b1', 1000, 3000, 500)], layerFx: [{ target: 'broll:b1', reverse: true as const }] }
    const next = { ...prev, broll: [br('b1', 1000, 2500, 500), br('b1~2500', 2500, 3000, 2000)] }
    const out = reconcileLayerFx(prev, next)
    expect(out.broll!.find((b) => b.id === 'b1')!.inMs).toBe(1000)
    expect(out.broll!.find((b) => b.id === 'b1~2500')!.inMs).toBe(500)
  })
  it('deleted B-roll drops its row; duplicate / copy-paste carry it', () => {
    const e = { ...base(), broll: [br('b1', 1000, 3000)], layerFx: [{ target: 'broll:b1', blend: 'multiply' as const, key: { color: '#00ff00', sim: 40, blend: 10, spill: 50 } }] }
    expect(reconcileLayerFx(e, { ...e, broll: [] }).layerFx).toBeUndefined()
    const d = duplicateItems({ edits: e, previewEdits: e }, [{ lane: 'broll', id: 'b1' }])!
    const nid = d.refs[0]!.id
    expect(d.edits.layerFx!.find((r) => r.target === `broll:${nid}`)).toMatchObject({ blend: 'multiply', key: { sim: 40 } })
    const clip = copyItems(e, [{ lane: 'broll', id: 'b1' }])!
    const p = pasteItems({ edits: e, previewEdits: e }, clip, 6000)!
    expect(p.edits.layerFx!.filter((r) => r.blend === 'multiply').length).toBe(2)
  })
})

describe('G4c normalizers (worker parity)', () => {
  it('stabilize ranges', () => {
    expect(normalizeStabilize([{ fromMs: 2000, toMs: 2050 }, { fromMs: 0, toMs: 1000.6, amount: 150 }, { fromMs: 500, toMs: 3000, amount: 30 }])).toEqual([{ fromMs: 0, toMs: 1001, amount: 100 }, { fromMs: 1001, toMs: 3000, amount: 30 }])
    expect(normalizeStabilize([])).toBeUndefined()
    const s = setStabilize(undefined, 1000, 4000, 70)
    expect(stabilizeFor(s, 1500, 2000)).toBe(70)
    expect(setStabilize(s, 1000, 4000, null)).toBeUndefined()
  })
  it('blur regions + sigma', () => {
    const n = normalizeBlurRegions([{ id: 'r1', startMs: 0, endMs: 50 }, { id: 'r2', startMs: 100, endMs: 2000, mode: 'faces', amount: 0 }, { id: 'bad id', startMs: 0, endMs: 900 }])!
    expect(n.map((r) => r.id)).toEqual(['r2'])
    expect(n[0]).toMatchObject({ mode: 'faces', amount: 1 })
    expect(blurSigma(60, 1080)).toBeCloseTo(25.92, 2)
    const a = addBlurRegion(undefined, 500, 10000)!
    expect(a.list[0]).toMatchObject({ startMs: 500, endMs: 3500, mode: 'manual', amount: 60 })
    expect(patchBlurRegion(a.list, a.id, null)).toBeUndefined()
    expect(exportOnlyNote({ ...base(), blurRegions: [{ ...a.list[0]!, mode: 'faces' }] })).toMatch(/Face blur tracking/)
  })
  it('smooth slow-mo gate', () => {
    expect(normalizeSmoothSlowmo('motion')).toBe('motion')
    expect(normalizeSmoothSlowmo('x')).toBeUndefined()
    const pieces = [{ startMs: 0, endMs: 5000, speed: 0.5 }]
    expect(slowOutputS(pieces)).toBe(10)
    expect(smoothMode('motion', pieces, 1080, 1920)).toBe('motion')
    expect(smoothMode('motion', pieces, 2160, 3840)).toBe('blend')
    expect(smoothMode('motion', [{ startMs: 0, endMs: 20000, speed: 0.5 }], 1080, 1920)).toBe('blend')
    expect(smoothMode(undefined, pieces, 1080, 1920)).toBeNull()
  })
})

describe('G4c steering fixes', () => {
  const el = (tagName: string, attrs: Record<string, string> = {}, extra: Record<string, unknown> = {}) => ({
    tagName,
    type: attrs.type,
    isContentEditable: false,
    getAttribute: (n: string) => attrs[n] ?? null,
    closest: (s: string) => (s.includes('role="slider"') && attrs.inSlider ? {} : null),
    ...extra,
  })
  it('Home / Ctrl+Home on a focused slider or any input is not an editor shortcut', () => {
    const range = el('INPUT', { type: 'range' })
    expect(isTextEntryTarget(range)).toBe(false) // old guard let Home through to the timeline
    expect(isFormControlTarget(range)).toBe(true)
    expect(isFormControlTarget(el('DIV', { role: 'slider' }))).toBe(true)
    expect(isFormControlTarget(el('SPAN', { inSlider: '1' }))).toBe(true)
    expect(isFormControlTarget(el('INPUT', { type: 'checkbox' }))).toBe(true)
    expect(isFormControlTarget(el('SELECT'))).toBe(true)
    expect(isFormControlTarget(el('DIV'))).toBe(false)
    expect(isFormControlTarget(el('BUTTON'))).toBe(false)
    expect(isFormControlTarget(null)).toBe(false)
  })
  it('stock CDN hosts without ACAO load plain (no probe, no crossOrigin)', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    expect(isNoCorsHost('https://cdn.pixabay.com/video/x.mp4')).toBe(true)
    expect(isNoCorsHost('https://transovo-clips.s3.us-east-005.backblazeb2.com/a/source.mp4')).toBe(false)
    expect(corsKnown('https://cdn.pixabay.com/video/y.mp4')).toBe('no')
    expect(corsState('https://cdn.pixabay.com/video/y.mp4')).toBe('no')
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
  it('workspace list GETs never answer 400: missing table → 200 empty, other errors → 500', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(isSchemaMissingError({ code: 'P2021', message: 'The table `public.clip_fonts` does not exist' })).toBe(true)
    expect(isSchemaMissingError(new TypeError("Cannot read properties of undefined (reading 'findMany')"))).toBe(true)
    expect(isSchemaMissingError(new Error('boom'))).toBe(false)
    const ok = await workspaceListResponse('fonts', 'fonts', async () => [{ id: 'f1' }])
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ data: { fonts: [{ id: 'f1' }] } })
    const missing = await workspaceListResponse('fonts', 'fonts', async () => {
      throw Object.assign(new Error('The table `public.clip_fonts` does not exist in the current database.'), { code: 'P2021' })
    })
    expect(missing.status).toBe(200)
    expect(await missing.json()).toEqual({ data: { fonts: [], unavailable: true } })
    const bad = await workspaceListResponse('luts', 'luts', async () => {
      throw new Error('db down')
    })
    expect(bad.status).toBe(500)
    expect(warn).toHaveBeenCalledWith('[clipper:fonts] list_unavailable', expect.stringContaining('clip_fonts'))
    warn.mockRestore()
  })
})
