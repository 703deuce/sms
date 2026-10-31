import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  applyLook,
  COLOR_PRESET_IDS,
  lookForSpec,
  lookKey,
  normalizeColorEdits,
  videoSpecAtSource,
  type ColorSpec,
} from '@/lib/clips/editor/color'
import {
  atempoChain,
  normalizeSegmentSpeeds,
  speedWarpPieces,
  warpedDurationMs,
  warpMs,
  type SegmentSpeed,
} from '@/lib/clips/editor/speed'
import { normalizeTextItems, textAssPx } from '@/lib/clips/editor/text-items'

/**
 * E4 preview/export parity: color look math (CSS/SVG preview ↔ worker .cube LUT), per-item speed warp
 * (preview playbackRate ↔ export_post piecewise warp), text item normalization / ASS sizes.
 * The same JSON is asserted by worker/tests/test_e4_parity.py.
 * Regenerate after an intentional math change: WRITE_E4_FIXTURE=1 npx vitest run e4-parity
 */
const here = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.resolve(here, '../../worker/tests/fixtures/e4_parity.json')

const SPECS: ColorSpec[] = [
  {},
  ...COLOR_PRESET_IDS.map((preset) => ({ preset })),
  ...COLOR_PRESET_IDS.map((preset) => ({ preset, intensity: 50 })),
  { adjust: { brightness: 40 } },
  { adjust: { brightness: -60, contrast: 30 } },
  { adjust: { saturation: -100 } },
  { adjust: { saturation: 80, vibrance: 50 } },
  { adjust: { temperature: 100, tint: -100 } },
  { adjust: { temperature: -70, tint: 40, contrast: -50 } },
  { preset: 'film', intensity: 70, adjust: { brightness: 10, saturation: 20 } },
  { preset: 'vintage', adjust: { temperature: 30 } },
]
const PIXELS: [number, number, number][] = [
  [0, 0, 0], [1, 1, 1], [0.5, 0.5, 0.5], [0.9, 0.2, 0.1], [0.1, 0.6, 0.3], [0.2, 0.3, 0.9],
  [0.95, 0.8, 0.65], [0.05, 0.1, 0.12], [0.33, 0.66, 0.99], [0.7, 0.7, 0.2],
]

const SPEED_CASES: { name: string; segs: [number, number][]; speeds: unknown }[] = [
  { name: 'single 2x', segs: [[1000, 5000]], speeds: [{ fromMs: 1000, toMs: 5000, speed: 2 }] },
  { name: 'partial range', segs: [[0, 4000]], speeds: [{ fromMs: 1000, toMs: 2500, speed: 0.5 }] },
  { name: 'two segments, reorder', segs: [[6000, 8000], [0, 3000]], speeds: [{ fromMs: 0, toMs: 3000, speed: 4 }, { fromMs: 7000, toMs: 9000, speed: 0.25 }] },
  { name: 'adjacent same speed merges', segs: [[0, 1000], [2000, 3000]], speeds: [{ fromMs: 0, toMs: 3000, speed: 1.5 }] },
  { name: 'normalize clamps + overlap', segs: [[0, 5000]], speeds: [{ fromMs: 0, toMs: 3000, speed: 9 }, { fromMs: 2000, toMs: 4000, speed: 0.1 }, { fromMs: 4500, toMs: 4400, speed: 2 }, { fromMs: 4600, toMs: 4900, speed: 1 }] },
]
const WARP_SAMPLES = [0, 1, 500, 999, 1000, 1500, 2500, 3000, 3999, 4000, 5000, 6000]

const TEXT_RAW = [
  { id: 'a', text: 'Hello', startMs: 100.4, endMs: 900, x: 50, y: 30, style: { font: 'Anton', size: 92, color: '#ffcc00', align: 'left', case: 'upper', stroke: { color: '#000000', width: 6 }, box: { color: '#111111', opacity: 60, pad: 12 } } },
  { id: 'b', text: 'x', startMs: 5000, endMs: 5100, x: 140, y: -5, style: { font: 'Comic Sans', size: 999, shadow: { dist: 4, opacity: 0 } } },
  { id: 'bad id', text: 'y', startMs: 0, endMs: 1000 },
  { id: 'c', text: '   ', startMs: 0, endMs: 1000 },
  { id: 'a', text: 'dup', startMs: 0, endMs: 1000 },
]

function build() {
  return {
    specs: SPECS,
    pixels: PIXELS,
    looks: SPECS.map((s) => {
      const look = lookForSpec(s)
      return { key: lookKey(s), out: PIXELS.map((p) => applyLook(look, p).map((v) => Math.round(v * 1e6) / 1e6)) }
    }),
    colorEdits: (() => {
      const c = normalizeColorEdits({
        video: { preset: 'warm' },
        segments: [{ fromMs: 1000, toMs: 2000, spec: { preset: 'bw' } }, { fromMs: 3000, toMs: 4000, spec: {} }],
      })!
      return { edits: c, at: [0, 999, 1000, 1999, 2000, 3500, 4000].map((ms) => [ms, lookKey(videoSpecAtSource(c, ms))]) }
    })(),
    speedCases: SPEED_CASES.map((c) => {
      const speeds = normalizeSegmentSpeeds(c.speeds) as SegmentSpeed[] | undefined
      const pieces = speedWarpPieces(c.segs, speeds)
      return {
        name: c.name,
        segs: c.segs,
        raw: c.speeds,
        speeds: speeds ?? [],
        pieces,
        durationMs: Math.round(warpedDurationMs(pieces) * 1000) / 1000,
        warp: WARP_SAMPLES.map((t) => Math.round(warpMs(pieces, t) * 1000) / 1000),
      }
    }),
    atempo: [0.25, 0.3, 0.5, 0.75, 1, 1.25, 2, 3, 4].map((s) => [s, atempoChain(s)]),
    text: { raw: TEXT_RAW, clipEndMs: 5050, items: normalizeTextItems(TEXT_RAW, 5050) ?? [] },
    textPx: [[96, 1280], [92, 1920], [6, 720], [240, 1080]].map(([v, h]) => [v, h, textAssPx(v!, h!)]),
  }
}

describe('E4 parity fixture', () => {
  const now = build()
  it('matches worker/tests/fixtures/e4_parity.json (worker asserts the same file)', () => {
    if (process.env.WRITE_E4_FIXTURE === '1' || !existsSync(FIXTURE)) {
      writeFileSync(FIXTURE, JSON.stringify(now, null, 1) + '\n')
    }
    const saved = JSON.parse(readFileSync(FIXTURE, 'utf8'))
    expect(JSON.parse(JSON.stringify(now))).toEqual(saved)
  })

  it('identity look is exact and every preset changes a mid-grey or a colour', () => {
    expect(applyLook(lookForSpec({}), [0.25, 0.5, 0.75])).toEqual([0.25, 0.5, 0.75])
    for (const preset of COLOR_PRESET_IDS) {
      const l = lookForSpec({ preset })
      const a = applyLook(l, [0.9, 0.2, 0.1])
      const b = applyLook(l, [0.5, 0.5, 0.5])
      expect(Math.max(...a.map((v, i) => Math.abs(v - [0.9, 0.2, 0.1][i]!)), ...b.map((v) => Math.abs(v - 0.5)))).toBeGreaterThan(0.01)
    }
  })

  it('B&W and Noir are neutral (r = g = b)', () => {
    for (const preset of ['bw', 'noir'] as const) {
      const [r, g, b] = applyLook(lookForSpec({ preset }), [0.9, 0.2, 0.1])
      expect(Math.abs(r - g)).toBeLessThan(1e-9)
      expect(Math.abs(g - b)).toBeLessThan(1e-9)
    }
  })

  it('warp duration = Σ len / speed', () => {
    const p = speedWarpPieces([[0, 4000]], [{ fromMs: 1000, toMs: 3000, speed: 2 }])
    expect(warpedDurationMs(p)).toBe(1000 + 1000 + 1000)
    expect(atempoChain(0.25)).toEqual([0.5, 0.5])
    expect(atempoChain(4)).toEqual([2, 2])
  })
})
