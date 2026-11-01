/**
 * G4a color grade v2 parity: color-grade.ts / color.ts ↔ worker clips_worker/color_grade.py.
 * The same JSON (worker/tests/fixtures/g4a_parity.json) is asserted by worker/tests/test_g4a.py.
 * Regenerate after an intentional math change: WRITE_G4A_FIXTURE=1 npx vitest run g4a-parity
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { bakeGrid, gradeRgb, lookKey, normalizeColorSpec, type ColorSpec } from '@/lib/clips/editor/color'
import {
  canonGrade,
  grainCells,
  grainHash,
  grainOffset,
  hslWeights,
  parseCube,
  sharpenKernel,
  tetra,
  vignetteMask,
  type CubeLut,
  type Rgb,
} from '@/lib/clips/editor/color-grade'

const here = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.resolve(here, '../../worker/tests/fixtures/g4a_parity.json')

/** A deterministic 4³ "creative" LUT (hue twist + lifted blacks). */
function demoCubeText(): string {
  const n = 4
  const rows = ['TITLE "demo"', `LUT_3D_SIZE ${n}`]
  for (let b = 0; b < n; b++)
    for (let g = 0; g < n; g++)
      for (let r = 0; r < n; r++) {
        const R = r / (n - 1)
        const G = g / (n - 1)
        const B = b / (n - 1)
        rows.push([0.05 + 0.9 * (0.8 * R + 0.2 * G), 0.03 + 0.9 * (0.1 * R + 0.8 * G + 0.1 * B), 0.08 + 0.85 * (0.3 * G + 0.7 * B)].map((v) => v.toFixed(6)).join(' '))
      }
  return rows.join('\n') + '\n'
}

const RAW_SPECS: unknown[] = [
  { adjust: { exposure: 40 } },
  { adjust: { exposure: -70, highlights: -50, shadows: 60 } },
  { preset: 'film', intensity: 70, adjust: { contrast: 20, highlights: 30 } },
  { curves: { m: [[0, 0.05], [0.25, 0.2], [0.75, 0.85], [1, 0.97]], r: [[0, 0], [0.5, 0.56], [1, 1]] } },
  { wheels: { lift: { x: -0.3, y: 0.2, l: 0.1 }, gamma: { x: 0.1, y: -0.4, l: -0.2 }, gain: { x: 0.25, y: 0, l: 0.15 } } },
  { hsl: { red: { h: 20, s: -30, l: 10 }, green: { h: -40, s: 50, l: -20 }, blue: { h: 0, s: 80, l: 40 } } },
  { lut: { id: 'demo', intensity: 65 }, adjust: { saturation: 15 } },
  { preset: 'teal_orange', lut: { id: 'demo' }, hsl: { orange: { h: 10, s: 20, l: 5 } }, curves: { b: [[0, 0.1], [1, 0.9]] }, adjust: { exposure: 15, tint: -20 } },
  { fx: { sharpen: 40, vignette: 60, grain: 30 }, adjust: { brightness: 10 } },
  { adjust: { contrast: 25, temperature: 30 } },
  { adjust: { whites: 100 } },
  { adjust: { blacks: -100 } },
  { adjust: { fade: 50 } },
  { adjust: { fade: 100 } },
]

function samples(): Rgb[] {
  const out: Rgb[] = [
    [0, 0, 0],
    [1, 1, 1],
    [0.5, 0.5, 0.5],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 0],
    [0, 1, 1],
    [1, 0, 1],
  ]
  let s = 12345
  const rnd = () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0
    return ((s >>> 8) & 0xffff) / 0xffff
  }
  while (out.length < 64) out.push([rnd(), rnd(), rnd()].map((v) => Math.round(v * 255) / 255) as Rgb)
  return out
}

function build() {
  const cube = demoCubeText()
  const lut: CubeLut = parseCube(cube)
  const pts = samples()
  const specs = RAW_SPECS.map((r) => normalizeColorSpec(r) as ColorSpec)
  return {
    cube,
    samples: pts,
    specs: specs.map((spec, i) => ({
      raw: RAW_SPECS[i],
      spec,
      key: lookKey(spec),
      canon: canonGrade(spec),
      out: pts.map((p) => gradeRgb(spec, p, lut).map((v) => Math.round(v * 1e7) / 1e7)),
      grid5: Array.from(bakeGrid(spec, 5, lut)).map((v) => Math.round(v * 1e5) / 1e5),
    })),
    tetra: pts.slice(0, 16).map((p) => tetra(lut.data, lut.size, [p[0] * 3, p[1] * 3, p[2] * 3]).map((v) => Math.round(v * 1e7) / 1e7)),
    hslWeights: [0, 15, 45, 90, 150, 200, 260, 300, 340, 359.5].map((h) => hslWeights(h).map((v) => Math.round(v * 1e9) / 1e9)),
    grainHash: [
      [0, 0, 0],
      [1, 2, 3],
      [640, 360, 7],
      [1919, 1079, 7],
      [12, 99, 5],
    ].map(([x, y, k]) => grainHash(x!, y!, k!)),
    grainCells: Array.from(grainCells(30, 6, 4).slice(0, 80)),
    grainOffsets: [0, 1, 2, 7, 8, 9].map((f) => grainOffset(f)),
    vignette: Array.from(vignetteMask(60, 16, 9)),
    sharpen: sharpenKernel(40),
  }
}

describe('G4a color grade parity', () => {
  it('matches worker/tests/fixtures/g4a_parity.json (worker asserts the same file)', () => {
    const got = build()
    if (process.env.WRITE_G4A_FIXTURE === '1' || !fs.existsSync(FIXTURE)) {
      fs.mkdirSync(path.dirname(FIXTURE), { recursive: true })
      fs.writeFileSync(FIXTURE, JSON.stringify(got) + '\n')
    }
    const want = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'))
    expect(got.specs.map((s) => s.key)).toEqual(want.specs.map((s: { key: string }) => s.key))
    expect(got.specs.map((s) => s.canon)).toEqual(want.specs.map((s: { canon: string }) => s.canon))
    got.specs.forEach((s, i) => {
      s.out.forEach((v, j) => v.forEach((x, c) => expect(Math.abs(x - want.specs[i].out[j][c])).toBeLessThan(1e-6)))
    })
    expect(got.grainHash).toEqual(want.grainHash)
    expect(got.vignette).toEqual(want.vignette)
  })

  it('E4-only specs keep their E4 key and output (no regression)', () => {
    const spec = normalizeColorSpec({ preset: 'vivid', adjust: { contrast: 10 } })!
    expect(lookKey(spec)).toBe('vivid_100_0_10_0_0_0_0')
    expect(lookKey(normalizeColorSpec({ preset: 'vivid', adjust: { contrast: 10, exposure: 5 } }))).toMatch(/^vivid_100_0_10_0_0_0_0_g[0-9a-f]{8}$/)
  })

  it('v2 normalization drops identity / junk and clamps', () => {
    expect(normalizeColorSpec({ curves: { m: [[0, 0], [1, 1]] }, hsl: { red: { h: 0, s: 0, l: 0 } }, fx: { grain: 0 } })).toBeUndefined()
    const s = normalizeColorSpec({ wheels: { lift: { x: 3, y: 4, l: 9 } }, fx: { vignette: 250 }, lut: { id: 'x', intensity: 0 } })!
    expect(s.wheels!.lift).toEqual({ x: 0.6, y: 0.8, l: 1 })
    expect(s.fx).toEqual({ vignette: 100 })
    expect(s.lut).toBeUndefined()
  })

  it('parseCube rejects 1D / malformed LUTs', () => {
    expect(() => parseCube('LUT_1D_SIZE 4\n0 0 0\n')).toThrow(/1D/)
    expect(() => parseCube('LUT_3D_SIZE 2\n0 0 0\n')).toThrow(/rows/)
    expect(() => parseCube('LUT_3D_SIZE 99\n')).toThrow(/size/)
  })
})
