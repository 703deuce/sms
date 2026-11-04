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

export const FX2_KEYS = [
  'pixelate',
  'blur',
  'glow',
  'rgbsplit',
  'glitch',
  'shake',
  'flicker',
  'scanlines',
  // EFFECTS1 (append only): colour looks + geometry.
  'mono',
  'sepia',
  'invert',
  'mirror',
  'zoom',
  // EFFECTS1b (append only)
  'flash',
  'leak',
  'kenburns',
] as const
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
  mono: 'Black & white',
  sepia: 'Sepia',
  invert: 'Negative',
  mirror: 'Mirror (on when > 0)',
  zoom: 'Punch-in zoom',
  flash: 'Flash / strobe',
  leak: 'Light leak',
  kenburns: 'Ken Burns (slow zoom)',
}

/** EFFECTS1b flash: white mix k on frames F mod 15 < 2 (export blend A + (255 − A)·k). */
export const flashMix = (v: number, frame: number) => (frame % 15 < 2 ? (v / 100) * 0.8 : 0)
/** EFFECTS1b light leak: warm (255,140,40)·a radial falloff from (0,0), radius 0.9·max(w,h); screen blend. */
export const LEAK_RGB = [255, 140, 40] as const
export const leakRadius = (w: number, h: number) => 0.9 * Math.max(w, h)
export function leakSvgUrl(v: number, w: number, h: number): string {
  const a = v / 100
  const c = LEAK_RGB.map((x) => Math.round(x * a)).join(',')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs><radialGradient id="l" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="${leakRadius(w, h)}">` +
    `<stop offset="0" stop-color="rgb(${c})"/><stop offset="1" stop-color="rgb(0,0,0)"/></radialGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#l)"/></svg>`
  return `data:image/svg+xml;base64,${typeof btoa === 'function' ? btoa(svg) : Buffer.from(svg).toString('base64')}`
}
/** EFFECTS1b Ken Burns: zoom 1 + min(t, 10)·0.02·v/100 at output time t = frame / 30. */
export const kenBurnsZoom = (v: number, frame: number) => 1 + Math.min(frame / 30, 10) * 0.02 * (v / 100)

/**
 * EFFECTS1 colour looks: 3×3 RGB matrices (row-major) mixed with identity by v/100. Export =
 * ffmpeg colorchannelmixer with the SAME numbers (fx_library.mono_matrix / sepia_matrix).
 */
export const LUMA_709 = [0.2126, 0.7152, 0.0722] as const
export const SEPIA_M = [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131] as const
function mixIdentity(target: readonly number[], v: number): number[] {
  const a = v / 100
  return target.map((t, i) => (1 - a) * (i % 4 === 0 ? 1 : 0) + a * t)
}
export const monoMatrix = (v: number) => mixIdentity([...LUMA_709, ...LUMA_709, ...LUMA_709], v)
export const sepiaMatrix = (v: number) => mixIdentity(SEPIA_M, v)
/** Negative: out = x·(1 − 2a) + a (a = v/100). Export = negate blended at opacity a. */
export const invertLinear = (v: number): [number, number] => [1 - (2 * v) / 100, v / 100]
/** Punch-in: uniform zoom 1 + 0.5·v/100, even export size, centre crop (fx_library.zoom_size). */
export const zoomScale = (v: number) => 1 + (v / 100) * 0.5
export function zoomSize(v: number, w: number, h: number): [number, number] {
  const z = zoomScale(v)
  return [2 * Math.ceil((w * z) / 2), 2 * Math.ceil((h * z) / 2)]
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

export function geomCss(fx: Partial<Record<string, number>> | null | undefined, w: number, h: number, frame: number): string {
  const out: string[] = []
  const s = shakeCss(fx?.shake ?? 0, w, h, frame)
  if (s) out.push(s)
  if (fx?.mirror) out.push('scaleX(-1)')
  if (fx?.kenburns) {
    const z = kenBurnsZoom(fx.kenburns, frame)
    const kw = 2 * Math.ceil((w * z) / 2)
    const kh = 2 * Math.ceil((h * z) / 2)
    out.push(`scale(${Math.round((kw / w) * 1e4) / 1e4}, ${Math.round((kh / h) * 1e4) / 1e4})`)
  }
  if (fx?.zoom) {
    const [zw, zh] = zoomSize(fx.zoom, w, h)
    out.push(`scale(${Math.round((zw / w) * 1e4) / 1e4}, ${Math.round((zh / h) * 1e4) / 1e4})`)
  }
  return out.join(' ')
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
  { id: 'bw', label: 'Black & white', fx: { mono: 100 } },
  { id: 'old_film', label: 'Old film', fx: { sepia: 80, grain: 30, vignette: 40, flicker: 15 } },
  { id: 'negative', label: 'Negative', fx: { invert: 100 } },
  { id: 'mirror', label: 'Mirror', fx: { mirror: 100 } },
  { id: 'punch_in', label: 'Punch-in', fx: { zoom: 30 } },
  { id: 'noir', label: 'Noir', fx: { mono: 100, vignette: 55, grain: 25 } },
  { id: 'soft_blur', label: 'Soft blur', fx: { blur: 35 } },
]
