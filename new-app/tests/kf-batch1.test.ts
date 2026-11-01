import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import {
  deleteKeyframeTimes,
  easeValue,
  moveTrackPoint,
  pointEase,
  setKeyframeCurve,
  setKeyframeEase,
  shiftKeyframeTimes,
  toggleKfSelection,
  type KeyframeTarget,
} from '@/lib/clips/editor/keyframes'
import { EASES, EASE_BZ, normalizeBz, normalizeKeyframeTracks } from '@/lib/clips/editor/motion-schema'
import { applyCustomCurve, applySpeedCurve, readCurveBars } from '@/lib/clips/editor/speed-curves'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
const base = () => normalizeEdits(defaultEdits(bounds), bounds)
const target: KeyframeTarget = 'video'

describe('KF batch 1 (pure)', () => {
  it('pointEase presets match easeValue', () => {
    const us = [0, 0.1, 0.25, 0.5, 0.9, 1]
    for (const e of EASES) {
      const [a, b] = EASE_BZ[e]
      for (const u of us) {
        expect(Math.abs(pointEase({ tMs: 0, v: 0, bz: [a, b] }, u) - easeValue(e, u))).toBeLessThan(1e-12)
      }
    }
  })

  it('pointEase custom bz stays in [0,1]', () => {
    expect(pointEase({ tMs: 0, v: 0, bz: [1, 1] }, 0.25)).toBeCloseTo(0.578125, 12)
    for (let a = 0; a <= 1; a += 0.17) {
      for (let b = 0; b <= 1; b += 0.23) {
        for (let u = 0; u <= 1; u += 0.11) {
          const y = pointEase({ tMs: 0, v: 0, bz: [a, b] }, u)
          expect(y).toBeGreaterThanOrEqual(-1e-12)
          expect(y).toBeLessThanOrEqual(1 + 1e-12)
        }
      }
    }
  })

  it('normalizeBz', () => {
    expect(normalizeBz([0, 1])).toEqual({ ease: 'inOut' })
    expect(normalizeBz([1 / 3, 2 / 3])).toEqual({})
    expect(normalizeBz([1.4, -2])).toEqual({ bz: [1, 0] })
    expect(normalizeBz('x')).toBeNull()
    expect(normalizeBz([0.234, 0.5])).toEqual({ bz: [0.23, 0.5] })
  })

  it('normalizeKeyframeTracks keeps bz; bz wins over ease', () => {
    const raw = [{ target: 'video', prop: 'x', points: [{ tMs: 0, v: 0, ease: 'in', bz: [0.5, 0.5] }] }]
    const out = normalizeKeyframeTracks(raw)!
    expect(out[0]!.points[0]!.bz).toEqual([0.5, 0.5])
    expect(out[0]!.points[0]!.ease).toBeUndefined()
  })

  it('setKeyframeCurve and setKeyframeEase', () => {
    let e: ClipEditsV2 = {
      ...base(),
      keyframes: [{ target, prop: 'x', points: [{ tMs: 0, v: 0 }, { tMs: 1000, v: 10 }] }],
    }
    e = setKeyframeCurve(e, target, 'x', 0, [0.8, 0.2])
    expect(e.keyframes![0]!.points[0]!.bz).toEqual([0.8, 0.2])
    e = setKeyframeEase(e, target, 'x', 0, 'out')
    expect(e.keyframes![0]!.points[0]!.bz).toBeUndefined()
    expect(e.keyframes![0]!.points[0]!.ease).toBe('out')
  })

  it('shiftKeyframeTimes', () => {
    const e: ClipEditsV2 = {
      ...base(),
      keyframes: [
        { target, prop: 'x', points: [{ tMs: 0, v: 0 }, { tMs: 500, v: 1 }, { tMs: 1000, v: 2 }] },
        { target, prop: 'opacity', points: [{ tMs: 500, v: 50 }, { tMs: 1000, v: 100 }] },
      ],
    }
    const r = shiftKeyframeTimes(e, target, [0, 500], 500)
    expect(r.times).toEqual([500, 1000])
    const x = r.edits.keyframes!.find((k) => k.prop === 'x')!.points.map((p) => p.tMs)
    expect(x).toEqual([500, 1000])
    const clamped = shiftKeyframeTimes(e, target, [0, 500], -800)
    expect(clamped.times).toEqual([0, 500])
  })

  it('deleteKeyframeTimes', () => {
    const e: ClipEditsV2 = {
      ...base(),
      keyframes: [{ target, prop: 'x', points: [{ tMs: 0, v: 5 }, { tMs: 500, v: 10 }] }],
    }
    const d = deleteKeyframeTimes(e, target, [0, 500])
    const tr = d.keyframes!.find((k) => k.prop === 'x')!
    expect(tr.points).toEqual([])
    expect(tr.value).toBe(10)
  })

  it('toggleKfSelection', () => {
    expect(toggleKfSelection(null, target, 100, false)).toEqual({ target, times: [100] })
    const a = toggleKfSelection({ target, times: [100] }, target, 200, true)
    expect(a.times).toEqual([100, 200])
    const b = toggleKfSelection(a, target, 100, true)
    expect(b.times).toEqual([200])
    const c = toggleKfSelection({ target, times: [100] }, 'voice', 50, true)
    expect(c).toEqual({ target: 'voice', times: [50] })
    const d = toggleKfSelection({ target, times: [100] }, target, 100, true)
    expect(d.times).toEqual([100])
  })

  it('moveTrackPoint', () => {
    const e: ClipEditsV2 = {
      ...base(),
      keyframes: [
        { target, prop: 'x', points: [{ tMs: 500, v: 1 }] },
        { target, prop: 'y', points: [{ tMs: 500, v: 2 }] },
      ],
    }
    const m = moveTrackPoint(e, target, 'x', 500, 800)
    expect(m.keyframes!.find((k) => k.prop === 'x')!.points[0]!.tMs).toBe(800)
    expect(m.keyframes!.find((k) => k.prop === 'y')!.points[0]!.tMs).toBe(500)
  })

  it('readCurveBars and applyCustomCurve', () => {
    const speeds = applySpeedCurve(undefined, 0, 4000, 'hero')
    const bars = readCurveBars(speeds, 0, 4000)
    const heroPieces = readCurveBars(applySpeedCurve(undefined, 0, 4000, 'hero'), 0, 4000)
    expect(bars).toEqual(heroPieces)
    const custom = [0.5, 0.5, 1, 1, 2, 2, 4, 4]
    const out = applyCustomCurve(speeds, 0, 4000, custom)!
    expect(readCurveBars(out, 0, 4000)).toEqual(custom)
    expect(applyCustomCurve(speeds, 0, 4000, [1, 2])).toBe(speeds)
  })
})
