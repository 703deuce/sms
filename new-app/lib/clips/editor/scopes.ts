/**
 * G4a video scopes from frame pixels (RGBA, already graded): luma waveform, RGB + luma histogram and a
 * BT.709 vectorscope. Pure (tests/g4a-panel.test.ts).
 */
import { applyLook, bakeGrid, isIdentitySpec, isV2Spec, lookForSpec, type ColorSpec } from '@/lib/clips/editor/color'
import { GRID, tetra, type CubeLut } from '@/lib/clips/editor/color-grade'

export type ScopeData = {
  /** waveCols × 256 counts; column-major (col * 256 + level). */
  wave: Uint32Array
  waveCols: number
  /** [r, g, b, y] × 256 counts. */
  hist: [Uint32Array, Uint32Array, Uint32Array, Uint32Array]
  /** VEC × VEC counts (Cb → x, Cr → −y). */
  vec: Uint32Array
  pixels: number
}

export const VEC = 128

export const luma709 = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b
export function cbcr709(r: number, g: number, b: number): [number, number] {
  return [-0.1146 * r - 0.3854 * g + 0.5 * b, 0.5 * r - 0.4542 * g - 0.0458 * b]
}

export function computeScopes(px: ArrayLike<number>, w: number, h: number, waveCols = 128): ScopeData {
  const wave = new Uint32Array(waveCols * 256)
  const hist: ScopeData['hist'] = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]
  const vec = new Uint32Array(VEC * VEC)
  let n = 0
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const r = px[i]!
      const g = px[i + 1]!
      const b = px[i + 2]!
      const l = Math.min(255, Math.floor(luma709(r, g, b) + 0.5))
      hist[0][r]!++
      hist[1][g]!++
      hist[2][b]!++
      hist[3][l]!++
      const col = Math.min(waveCols - 1, Math.floor((x * waveCols) / w))
      wave[col * 256 + l]!++
      const [cb, cr] = cbcr709(r / 255, g / 255, b / 255)
      const vx = Math.min(VEC - 1, Math.max(0, Math.floor((cb + 0.5) * VEC)))
      const vy = Math.min(VEC - 1, Math.max(0, Math.floor((0.5 - cr) * VEC)))
      vec[vy * VEC + vx]!++
      n++
    }
  return { wave, waveCols, hist, vec, pixels: n }
}


/**
 * Pointwise grade of RGBA bytes with the export's semantics: v2 specs through the baked GRID³ grid
 * (tetrahedral, 8-bit truncation like ffmpeg lut3d), E4 looks through applyLook (rounded).
 * Spatial fx (sharpen / vignette / grain) are not part of the scopes.
 */
export function gradePixels(
  px: Uint8ClampedArray,
  specs: (ColorSpec | undefined | null)[],
  lutFor: (id: string) => CubeLut | null = () => null,
): Uint8ClampedArray {
  let cur = px
  for (const spec of specs) {
    if (!spec || isIdentitySpec(spec) || (!isV2Spec(spec) && !spec.preset && !spec.adjust)) continue
    const out = new Uint8ClampedArray(cur.length)
    if (isV2Spec(spec)) {
      const grid = bakeGrid(spec, GRID, spec.lut ? lutFor(spec.lut.id) : null)
      const k = (GRID - 1) / 255
      for (let i = 0; i < cur.length; i += 4) {
        const v = tetra(grid, GRID, [cur[i]! * k, cur[i + 1]! * k, cur[i + 2]! * k])
        out[i] = Math.floor(Math.min(1, Math.max(0, v[0])) * 255)
        out[i + 1] = Math.floor(Math.min(1, Math.max(0, v[1])) * 255)
        out[i + 2] = Math.floor(Math.min(1, Math.max(0, v[2])) * 255)
        out[i + 3] = 255
      }
    } else {
      const look = lookForSpec(spec)
      for (let i = 0; i < cur.length; i += 4) {
        const v = applyLook(look, [cur[i]! / 255, cur[i + 1]! / 255, cur[i + 2]! / 255])
        out[i] = Math.round(v[0] * 255)
        out[i + 1] = Math.round(v[1] * 255)
        out[i + 2] = Math.round(v[2] * 255)
        out[i + 3] = 255
      }
    }
    cur = out
  }
  return cur
}
