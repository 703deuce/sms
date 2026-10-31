/**
 * G4a model: adjustment layers (ops, timeline lane, ripple), color keyframes (normalize, stepping —
 * cross-checked with the worker via worker/tests/fixtures/g4a_runtime.json), scopes, auto color,
 * LUT naming. Regenerate the fixture: WRITE_G4A_FIXTURE=1 npx vitest run g4a-model
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import {
  addAdjustLayer,
  adjustLayersAt,
  normalizeAdjustLayers,
  patchAdjustLayer,
  removeAdjustLayer,
  ADJUST_MAX,
} from '@/lib/clips/editor/adjust-layers'
import {
  applyTimelineLaneState,
  buildTimelineItems,
  deleteItems,
  moveItems,
  rippleAnchoredItems,
  splitAt,
  timelineRows,
  trimItem,
} from '@/lib/clips/editor/clip-timeline'
import { gradeRgb, lookKey, normalizeColorSpec, type ColorSpec } from '@/lib/clips/editor/color'
import { adjustGradesAt, brollGradeAt, colorTracks, specWithOverrides, videoGradeAt } from '@/lib/clips/editor/grade-runtime'
import { hasMotion, normalizeKeyframeTracks, reconcileItemMotion, targetForItem } from '@/lib/clips/editor/keyframes'
import { COLOR_PROPS, propsForTarget } from '@/lib/clips/editor/motion-schema'
import { computeScopes, gradePixels } from '@/lib/clips/editor/scopes'
import { autoColor, solveNeutral } from '@/lib/clips/editor/auto-color'
import { lutName } from '@/lib/clips/luts-shared'
import { tabsFor } from '@/components/clips/editor/properties-panel'
import type { Rgb } from '@/lib/clips/editor/color-grade'

const here = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.resolve(here, '../../worker/tests/fixtures/g4a_runtime.json')
const bounds = { clipStartMs: 0, clipEndMs: 10000 }
const base = (patch: Partial<ClipEditsV2> = {}): ClipEditsV2 => ({ ...normalizeEdits(defaultEdits(bounds), bounds), ...patch })
const ctx = (e: ClipEditsV2) => ({ edits: e, previewEdits: e })

describe('G4a adjustment layers', () => {
  it('normalize: rounding, min span, max count, HSL / LUT stripped', () => {
    const raw = [
      { id: 'a', startMs: 100.5, endMs: 2000.4, spec: { adjust: { exposure: 20 }, hsl: { red: { h: 10, s: 0, l: 0 } }, lut: { id: 'x' } } },
      { id: 'b', startMs: 500, endMs: 550, spec: {} },
      { id: 'a', startMs: 0, endMs: 1000, spec: {} },
      ...Array.from({ length: 30 }, (_, i) => ({ id: `z${i}`, startMs: 0, endMs: 1000, spec: {} })),
    ]
    const n = normalizeAdjustLayers(raw)!
    expect(n[0]).toEqual({ id: 'a', startMs: 101, endMs: 2000, spec: { adjust: { exposure: 20 } } })
    expect(n.some((l) => l.id === 'b')).toBe(false)
    expect(n.filter((l) => l.id === 'a')).toHaveLength(1)
    expect(n.length).toBe(ADJUST_MAX)
  })

  it('add / patch / remove / at', () => {
    const r = addAdjustLayer(undefined, 9000, 10000, 1)!
    expect(r.layers[0]).toMatchObject({ startMs: 9000, endMs: 10000 })
    const p = patchAdjustLayer(r.layers, r.id, { spec: { adjust: { contrast: 30 }, lut: { id: 'q' } } as ColorSpec })!
    expect(p[0]!.spec).toEqual({ adjust: { contrast: 30 } })
    expect(adjustLayersAt(p, 9500)).toHaveLength(1)
    expect(adjustLayersAt(p, 10000)).toHaveLength(0)
    expect(removeAdjustLayer(p, r.id)).toBeUndefined()
  })

  it('edits round trip + isDefault / payload', () => {
    const e = normalizeEdits({ ...base(), adjustLayers: [{ id: 'a1', startMs: 0, endMs: 1000, spec: { adjust: { brightness: 10 } } }] } as never, bounds)
    expect(e.adjustLayers).toHaveLength(1)
    expect(normalizeEdits({ ...base(), adjustLayers: [] } as never, bounds).adjustLayers).toBeUndefined()
  })

  it('timeline: Adjustment row above B-roll, move / trim / split / delete, hide drops layers', () => {
    let e = base({
      broll: [{ id: 'b1', source: 'stock', assetId: 'x', startMs: 0, endMs: 3000 }],
      adjustLayers: [{ id: 'a1', startMs: 1000, endMs: 4000, spec: { adjust: { saturation: -50 } } }],
      keyframes: [{ target: 'adjust:a1', prop: 'cExposure', points: [{ tMs: 0, v: 0 }, { tMs: 2000, v: 40 }] }],
    })
    const rows = timelineRows(e).map((r) => r.lane)
    expect(rows.indexOf('adjust')).toBeGreaterThanOrEqual(0)
    expect(rows.indexOf('adjust')).toBeLessThan(rows.indexOf('broll'))
    const lanes = buildTimelineItems({ edits: e, previewEdits: e } as never)
    expect(lanes.adjust.map((i) => [i.id, i.startMs, i.endMs])).toEqual([['a1', 1000, 4000]])
    expect(targetForItem('adjust', 'a1')).toBe('adjust:a1')

    const moved = moveItems(ctx(e), [{ lane: 'adjust', id: 'a1' }], 500)!
    expect(moved.adjustLayers![0]).toMatchObject({ startMs: 1500, endMs: 4500 })
    const trimmed = trimItem(ctx(e), { lane: 'adjust', id: 'a1' }, 'start', 1500)!
    expect(trimmed.adjustLayers![0]).toMatchObject({ startMs: 1500, endMs: 4000 })
    // A left trim keeps color keyframes on the timeline (local −500).
    const rec = reconcileItemMotion(e, trimmed)
    expect(rec.keyframes![0]!.points.map((p) => p.tMs)).toEqual([-500, 1500])

    const split = splitAt(ctx(e), [{ lane: 'adjust', id: 'a1' }], 2000)!
    expect(split.adjustLayers!.map((l) => [l.startMs, l.endMs])).toEqual([
      [1000, 2000],
      [2000, 4000],
    ])
    const right = split.adjustLayers![1]!
    expect(split.keyframes!.find((k) => k.target === `adjust:${right.id}`)!.points.map((p) => p.tMs)).toEqual([-1000, 1000])

    const del = deleteItems(ctx(e), [{ lane: 'adjust', id: 'a1' }])!
    expect(del.adjustLayers).toBeUndefined()
    expect(del.keyframes).toBeUndefined()

    e = { ...e, timelineLanes: { adjust: { hidden: true } } }
    expect(applyTimelineLaneState(e).adjustLayers).toBeUndefined()
    expect(adjustGradesAt(e, 1500)).toEqual([])
  })

  it('ripple: layers follow the EDL like text items', () => {
    const prev = base({ adjustLayers: [{ id: 'a1', startMs: 5000, endMs: 7000, spec: { adjust: { contrast: 10 } } }] })
    const next = { ...prev, trimStartMs: 1000 } as ClipEditsV2
    const out = rippleAnchoredItems(prev, next, prev, next)
    const l = out.adjustLayers![0]!
    expect(l.endMs - l.startMs).toBe(2000)
    expect(l.startMs).toBeLessThanOrEqual(5000)
  })

  it('properties: an adjustment layer only has the Color tab', () => {
    const t = tabsFor('adjust:a1')
    expect(t.color).toBeNull()
    expect(t.video && t.audio && t.speed && t.animation).toBeTruthy()
  })
})

describe('G4a color keyframes', () => {
  it('normalize accepts color props on video / broll / adjust; not motion', () => {
    const k = normalizeKeyframeTracks([
      { target: 'video', prop: 'cExposure', points: [{ tMs: 0, v: -20 }, { tMs: 1000, v: 250 }] },
      { target: 'adjust:a1', prop: 'cSaturation', points: [{ tMs: 0, v: 10 }] },
      { target: 'broll:b1', prop: 'cTint', points: [{ tMs: 0, v: 5 }] },
    ])!
    expect(k).toHaveLength(3)
    expect(k[0]!.points[1]!.v).toBe(100)
    expect(hasMotion({ ...base(), keyframes: k })).toBe(false)
    expect(propsForTarget('adjust:a1')).toEqual([])
    expect(COLOR_PROPS).toContain('cHighlights')
  })

  it('stepped values: 100 ms steps, value at step start, overrides the slider', () => {
    const e = base({
      color: { video: { adjust: { brightness: 50, contrast: 20 } } },
      keyframes: [{ target: 'video', prop: 'cBrightness', points: [{ tMs: 0, v: 0 }, { tMs: 1000, v: 100 }] }],
    })
    expect(videoGradeAt(e, 0, 0)!.adjust).toEqual({ contrast: 20 })
    expect(videoGradeAt(e, 0, 399)!.adjust).toEqual({ brightness: 30, contrast: 20 })
    expect(videoGradeAt(e, 0, 1500)!.adjust).toEqual({ brightness: 100, contrast: 20 })
    expect(videoGradeAt(e, 0, null)!.adjust).toEqual({ brightness: 50, contrast: 20 })
  })

  it('B-roll keyframes are local to the item start', () => {
    const e = base({
      broll: [{ id: 'b1', source: 'stock', assetId: 'x', startMs: 2000, endMs: 5000 }],
      keyframes: [{ target: 'broll:b1', prop: 'cTemperature', points: [{ tMs: 0, v: 0 }, { tMs: 1000, v: 60 }] }],
    })
    expect(brollGradeAt(e, 'b1', 2500)!.adjust).toEqual({ temperature: 30 })
  })

  it('fixture shared with the worker (spec_with_overrides / adjust layers)', () => {
    const edits = {
      color: { video: { adjust: { exposure: 10 }, curves: { m: [[0, 0.05], [0.5, 0.55], [1, 0.95]] } } },
      adjustLayers: [
        { id: 'a1', startMs: 1000.4, endMs: 3000, spec: { adjust: { saturation: -40 }, fx: { vignette: 30 }, hsl: { red: { h: 5, s: 0, l: 0 } } } },
        { id: 'a2', startMs: 2000, endMs: 2050, spec: {} },
      ],
      keyframes: [
        { target: 'video', prop: 'cExposure', points: [{ tMs: 0, v: -30 }, { tMs: 2000, v: 45, ease: 'easeInOut' }, { tMs: 2600, v: 0 }] },
        { target: 'video', prop: 'cTint', points: [{ tMs: 500, v: 12.6 }] },
        { target: 'adjust:a1', prop: 'cContrast', points: [{ tMs: 0, v: 0 }, { tMs: 1000, v: 70 }] },
      ],
    }
    const layers = normalizeAdjustLayers(edits.adjustLayers)!
    const kfs = normalizeKeyframeTracks(edits.keyframes)!
    const e = { color: edits.color, keyframes: kfs } as unknown as ClipEditsV2
    const vt = colorTracks(e, 'video')
    const at = colorTracks(e, 'adjust:a1')
    const times = [0, 99, 100, 250, 999, 1000, 1550, 1999, 2000, 2340, 2599, 2600, 3100]
    const out = {
      edits,
      layers,
      video: times.map((t) => {
        const s = specWithOverrides(normalizeColorSpec(edits.color.video) ?? {}, vt, t)!
        return { t, adjust: s.adjust ?? {}, key: lookKey(s) }
      }),
      adjust: times.map((t) => {
        const s = specWithOverrides(layers[0]!.spec, at, t)!
        return { t, adjust: s.adjust ?? {}, key: lookKey(s) }
      }),
    }
    if (process.env.WRITE_G4A_FIXTURE === '1') fs.writeFileSync(FIXTURE, JSON.stringify(out, null, 1) + '\n')
    expect(JSON.parse(fs.readFileSync(FIXTURE, 'utf8'))).toEqual(JSON.parse(JSON.stringify(out)))
  })
})

describe('G4a scopes / auto color / LUT names', () => {
  it('computeScopes counts every pixel once per scope', () => {
    const px = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 128, 128, 128, 255])
    const d = computeScopes(px, 2, 2, 2)
    expect(d.pixels).toBe(4)
    expect(d.hist[0]!.reduce((a, b) => a + b, 0)).toBe(4)
    expect(d.wave.reduce((a, b) => a + b, 0)).toBe(4)
    expect(d.vec.reduce((a, b) => a + b, 0)).toBe(4)
    // Gray sits in the vectorscope centre.
    expect(d.vec[64 * 128 + 64]).toBe(1)
  })

  it('gradePixels == gradeRgb (E4 look rounded; v2 within lut3d truncation)', () => {
    const px = new Uint8ClampedArray([200, 120, 40, 255, 10, 60, 230, 255])
    const e4: ColorSpec = { adjust: { contrast: 30, temperature: 20 } }
    const g = gradePixels(px, [e4])
    const want = gradeRgb(e4, [200 / 255, 120 / 255, 40 / 255])
    expect(Array.from(g.slice(0, 3))).toEqual(want.map((v) => Math.round(v * 255)))
    const v2: ColorSpec = { adjust: { exposure: 30 }, wheels: { gain: { x: 0.2, y: 0, l: 0 } } }
    const g2 = gradePixels(px, [v2])
    const w2 = gradeRgb(v2, [10 / 255, 60 / 255, 230 / 255]).map((v) => v * 255)
    for (let i = 0; i < 3; i++) expect(Math.abs(g2[4 + i]! - w2[i]!)).toBeLessThanOrEqual(2)
  })

  it('WB eyedropper neutralizes the picked color with the visible sliders only', () => {
    const cast: Rgb = [0.55, 0.5, 0.45]
    const wb = solveNeutral({}, cast)
    expect(Number.isInteger(wb.temperature) && Number.isInteger(wb.tint)).toBe(true)
    expect(wb.temperature).toBeLessThan(0)
    const [r, g, b] = gradeRgb({ adjust: { temperature: wb.temperature, tint: wb.tint } }, cast)
    expect(Math.max(Math.abs(r - g), Math.abs(b - g))).toBeLessThan(Math.max(Math.abs(cast[0] - cast[1]), Math.abs(cast[2] - cast[1])) / 3)
  })

  it('Auto color brightens a dark, warm frame and only sets Adjust values', () => {
    const px: Rgb[] = []
    for (let i = 0; i < 400; i++) {
      const l = 0.05 + (i % 20) * 0.012
      px.push([l * 1.25, l, l * 0.75])
    }
    const out = autoColor({ preset: 'film' }, px)
    expect(out.preset).toBe('film')
    expect(Object.keys(out).sort()).toEqual(['adjust', 'preset'])
    expect(out.adjust!.exposure!).toBeGreaterThan(0)
    expect(out.adjust!.temperature!).toBeLessThan(0)
  })

  it('LUT display name: TITLE, else file name', () => {
    expect(lutName('TITLE "Teal Orange"\nLUT_3D_SIZE 2\n', 'x.cube')).toBe('Teal Orange')
    expect(lutName('LUT_3D_SIZE 2\n', 'Kodak 2383.CUBE')).toBe('Kodak 2383')
  })
})
