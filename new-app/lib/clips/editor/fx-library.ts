/**
 * G4b effects library: blur, glow, RGB split, glitch, shake, flicker, scanlines (0–100 each, stored
 * in ColorSpec.fx next to G4a's sharpen / vignette / grain). Mirror of worker
 * clips_worker/fx_library.py — the export renders them with ffmpeg 5.1 (gblur, blend screen,
 * rgbashift, crop + overlay, scale + crop, blend expr, multiply mask); the preview draws the same
 * definitions with SVG filter primitives (grade-filters.ts) and a CSS transform (shake).
 *
 * S = short side / 1080. Export frame F = floor(t·30); the preview uses floor(outMs·30/1000).
 * Order: grade → blur → glow → rgbsplit → glitch → sharpen → vignette → scanlines → flicker →
 * grain → shake. No imports (shared by lib/clips/edits.ts normalizers).
 */

export const FX2_KEYS = ['pixelate', 'blur', 'glow', 'rgbsplit', 'glitch', 'shake', 'flicker', 'scanlines'] as const
export type Fx2Key = (typeof FX2_KEYS)[number]

export const FX2_LABELS: Record<Fx2Key, string> = {
  pixelate: 'Pixelate',
  blur: 'Blur',
  glow: 'Glow',
  rgbsplit: 'RGB split',
  glitch: 'Glitch',
  shake: 'Shake',
  flicker: 'Flicker',
  scanlines: 'Scanlines',
}

const HASH_A = 1103
const HASH_B = 7919
const HASH_M = 997

export const unit = (w: number, h: number) => Math.min(w, h) / 1080
export const jround = (x: number) => Math.floor(x + 0.5)

/** EF-16: even block size in export px; v=0 → 0 (off). */
export function pixelateBlock(v: number, w: number, h: number): number {
  if (!v) return 0
  return 2 * Math.max(1, jround((v / 100) * 24 * unit(w, h)))
}
export function fxHash(k: number, salt: number): number {
  return ((((k * HASH_A + salt * HASH_B) % HASH_M) + HASH_M) % HASH_M) / HASH_M
}

export const blurSigma = (v: number, w: number, h: number) => (v / 100) * 16 * unit(w, h)
export const GLOW_SIGMA = 24
export const glowOpacity = (v: number) => (v / 100) * 0.8
export const rgbsplitPx = (v: number, w: number, h: number) => jround((v / 100) * 14 * unit(w, h))

export type GlitchBand = { h: number; sy: number; sx: number; maxY: number; amp: number }
export function glitchBands(v: number, w: number, h: number): GlitchBand[] {
  const amp = (w * 0.12 * v) / 100
  return [
    { h: Math.max(2, jround(h * 0.08)), sy: 2, sx: 3, maxY: Math.floor(h * 0.85), amp },
    { h: Math.max(2, jround(h * 0.04)), sy: 4, sx: 5, maxY: Math.floor(h * 0.9), amp: amp * 0.6 },
  ]
}
export const glitchThreshold = (v: number) => (v / 100) * 0.6

/** Per band [y0, dx] (export px) at export frame `frame`. */
export function glitchState(v: number, w: number, h: number, frame: number): [number, number][] {
  const k = Math.floor(frame / 3)
  const on = fxHash(k, 1) < glitchThreshold(v)
  return glitchBands(v, w, h).map((b) => [
    Math.floor(fxHash(k, b.sy) * b.maxY),
    on ? jround((fxHash(k, b.sx) * 2 - 1) * b.amp) : 0,
  ])
}

export const shakePad = (v: number, w: number, h: number) => Math.ceil((v / 100) * 0.04 * Math.min(w, h))
export function shakeSize(v: number, w: number, h: number): [number, number] {
  const p = shakePad(v, w, h)
  const z = Math.max((w + 2 * p) / w, (h + 2 * p) / h)
  return [2 * Math.ceil((w * z) / 2), 2 * Math.ceil((h * z) / 2)]
}
export function shakeOffset(v: number, w: number, h: number, frame: number): [number, number] {
  const k = Math.floor(frame / 2)
  const a = shakePad(v, w, h)
  return [jround((fxHash(k, 6) * 2 - 1) * a), jround((fxHash(k, 7) * 2 - 1) * a)]
}
/** CSS transform reproducing the export's scale + crop (layer-relative, origin = centre). */
export function shakeCss(v: number, w: number, h: number, frame: number): string {
  if (!v) return ''
  const [sw, sh] = shakeSize(v, w, h)
  const [ox, oy] = shakeOffset(v, w, h, frame)
  const r = (n: number) => Math.round(n * 1e4) / 1e4
  return `translate(${r((-ox / w) * 100)}%, ${r((-oy / h) * 100)}%) scale(${r(sw / w)}, ${r(sh / h)})`
}

export const flickerGain = (v: number, frame: number) => 1 - (v / 100) * 0.3 * fxHash(frame, 8)

export const scanlinePeriod = (w: number, h: number) => Math.max(2, jround(4 * unit(w, h)))
/** One column of the scanline mask (height h, 8-bit). */
export function scanlineRows(v: number, w: number, h: number): Uint8Array {
  const p = scanlinePeriod(w, h)
  const dark = jround(255 * (1 - (v / 100) * 0.6))
  const out = new Uint8Array(h)
  for (let y = 0; y < h; y++) out[y] = y % p >= Math.floor(p / 2) ? dark : 255
  return out
}

/** One-click looks (set several effects at once; manual sliders stay editable). */
export const FX_PRESETS: { id: string; label: string; fx: Partial<Record<Fx2Key | 'sharpen' | 'vignette' | 'grain', number>> }[] = [
  { id: 'film', label: 'Film', fx: { grain: 35, vignette: 35, flicker: 20 } },
  { id: 'vhs', label: 'VHS', fx: { rgbsplit: 30, scanlines: 40, blur: 8, grain: 25, glitch: 15 } },
  { id: 'dreamy', label: 'Dreamy', fx: { glow: 60, blur: 12 } },
  { id: 'glitch', label: 'Glitch', fx: { glitch: 70, rgbsplit: 40 } },
  { id: 'quake', label: 'Earthquake', fx: { shake: 70 } },
  { id: 'retro_tv', label: 'Retro TV', fx: { scanlines: 70, vignette: 50, flicker: 30 } },
]
