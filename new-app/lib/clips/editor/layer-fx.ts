/**
 * G4b per-B-roll layer effects: shape mask (+ feather, keyframable), chroma key, blend mode,
 * reverse. Additive JSON (`edits.layerFx`), no migration. Mirror: worker clips_worker/layer_fx.py
 * (parity fixture tests/fixtures/g4b_parity.json).
 *
 *  mask     alpha from a signed distance to the shape, feather = smoothstep width; evaluated on a
 *           low-res grid (MASK_SHORT px on the short side) that the export feeds to alphamerge
 *           (bilinear upscale) and the preview uses as CSS mask-image (same grid, same bytes).
 *           Keyframes: item-local ms, linear between keys, stepped every MASK_STEP_MS (both sides).
 *  key      ffmpeg colorkey (RGB distance) + despill; preview = the WebGL mirror (grade-gl.ts).
 *  blend    CSS mix-blend-mode ↔ ffmpeg blend (top = composite below, bottom = this layer), then
 *           the layer's alpha. normal = plain overlay.
 *  reverse  B-roll video plays backwards (export pre-renders a reversed copy in chunks).
 */

export type MaskShape = 'rect' | 'ellipse' | 'linear' | 'mirror'
export const MASK_SHAPES: readonly MaskShape[] = ['rect', 'ellipse', 'linear', 'mirror'] as const
export const MASK_LABELS: Record<MaskShape, string> = { rect: 'Rectangle', ellipse: 'Circle', linear: 'Linear', mirror: 'Mirror' }
export type MaskGeom = { x: number; y: number; w: number; h: number; rot: number; feather: number }
export type MaskKey = MaskGeom & { ms: number }
export type LayerMask = MaskGeom & { shape: MaskShape; invert?: true; keys?: MaskKey[] }
export type ChromaKey = { color: string; sim: number; blend: number; spill: number }
export const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'difference', 'exclusion', 'hardlight', 'addition'] as const
export type BlendMode = (typeof BLEND_MODES)[number]
export const BLEND_LABELS: Record<BlendMode, string> = {
  normal: 'Normal',
  multiply: 'Multiply',
  screen: 'Screen',
  overlay: 'Overlay',
  darken: 'Darken',
  lighten: 'Lighten',
  difference: 'Difference',
  exclusion: 'Exclusion',
  hardlight: 'Hard light',
  addition: 'Add',
}
/** CSS mix-blend-mode per mode (addition = plus-lighter). */
export const BLEND_CSS: Record<BlendMode, string> = {
  normal: 'normal',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  difference: 'difference',
  exclusion: 'exclusion',
  hardlight: 'hard-light',
  addition: 'plus-lighter',
}
export type LayerFx = { target: string; mask?: LayerMask; key?: ChromaKey; blend?: Exclude<BlendMode, 'normal'>; reverse?: true }

export const MASK_SHORT = 160
export const MASK_STEP_MS = 100
export const MASK_MAX_KEYS = 16
export const REVERSE_MAX_MS = 60_000
export const DEFAULT_MASK: LayerMask = { shape: 'rect', x: 50, y: 50, w: 60, h: 40, rot: 0, feather: 10 }
export const DEFAULT_KEY: ChromaKey = { color: '#00ff00', sim: 40, blend: 10, spill: 50 }

const fin = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}
const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const r2 = (v: number) => Math.round(v * 100) / 100
const HEX = /^#[0-9a-f]{6}$/

function geom(o: Record<string, unknown>, base: MaskGeom): MaskGeom {
  const g = (k: keyof MaskGeom, lo: number, hi: number) => {
    const n = fin(o[k])
    return n == null ? base[k] : r2(clampN(n, lo, hi))
  }
  return { x: g('x', -50, 150), y: g('y', -50, 150), w: g('w', 1, 200), h: g('h', 1, 200), rot: g('rot', -180, 180), feather: g('feather', 0, 100) }
}

export function normalizeMask(raw: unknown): LayerMask | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  if (!MASK_SHAPES.includes(o.shape as MaskShape)) return undefined
  const out: LayerMask = { shape: o.shape as MaskShape, ...geom(o, DEFAULT_MASK) }
  if (o.invert === true) out.invert = true
  if (Array.isArray(o.keys)) {
    const byMs = new Map<number, MaskKey>()
    for (const k of o.keys) {
      if (!k || typeof k !== 'object') continue
      const ms = fin((k as Record<string, unknown>).ms)
      if (ms == null || ms < 0) continue
      const m = Math.round(Math.min(ms, 3_600_000))
      byMs.set(m, { ms: m, ...geom(k as Record<string, unknown>, out) })
    }
    const keys = [...byMs.values()].sort((a, b) => a.ms - b.ms).slice(0, MASK_MAX_KEYS)
    if (keys.length) out.keys = keys
  }
  return out
}

export function normalizeChromaKey(raw: unknown): ChromaKey | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const color = typeof o.color === 'string' ? o.color.toLowerCase() : ''
  if (!HEX.test(color)) return undefined
  const n = (k: keyof ChromaKey, d: number) => {
    const v = fin(o[k])
    return Math.round(clampN(v == null ? d : v, 0, 100))
  }
  return { color, sim: n('sim', DEFAULT_KEY.sim), blend: n('blend', DEFAULT_KEY.blend), spill: n('spill', DEFAULT_KEY.spill) }
}

export function normalizeLayerFx(raw: unknown): LayerFx[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const byT = new Map<string, LayerFx>()
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const t = o.target
    if (typeof t !== 'string' || !/^broll:[A-Za-z0-9_~.:-]{1,128}$/.test(t)) continue
    const row: LayerFx = { target: t }
    const mask = normalizeMask(o.mask)
    if (mask) row.mask = mask
    const key = normalizeChromaKey(o.key)
    if (key) row.key = key
    if (typeof o.blend === 'string' && o.blend !== 'normal' && (BLEND_MODES as readonly string[]).includes(o.blend)) row.blend = o.blend as LayerFx['blend']
    if (o.reverse === true) row.reverse = true
    if (row.mask || row.key || row.blend || row.reverse) byT.set(t, row)
  }
  const out = [...byT.values()].sort((a, b) => (a.target < b.target ? -1 : a.target > b.target ? 1 : 0))
  return out.length ? out.slice(0, 200) : undefined
}

export function layerFxOf(edits: { layerFx?: LayerFx[] }, itemId: string): LayerFx | undefined {
  return normalizeLayerFx(edits.layerFx)?.find((r) => r.target === `broll:${itemId}`)
}

/** Replace one item's row (null / empty = remove). */
export function setLayerFx(list: LayerFx[] | undefined, itemId: string, patch: Partial<Omit<LayerFx, 'target'>> | null): LayerFx[] | undefined {
  const target = `broll:${itemId}`
  const rest = (list ?? []).filter((r) => r.target !== target)
  if (!patch) return normalizeLayerFx(rest)
  const cur = (list ?? []).find((r) => r.target === target) ?? { target }
  const next: Record<string, unknown> = { ...cur, ...patch, target }
  for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k]
  return normalizeLayerFx([...rest, next])
}

/** Mask geometry at item-local `localMs` (stepped to MASK_STEP_MS, linear between keys). */
export function maskGeomAt(mask: LayerMask, localMs: number): MaskGeom {
  const keys = mask.keys
  const base: MaskGeom = { x: mask.x, y: mask.y, w: mask.w, h: mask.h, rot: mask.rot, feather: mask.feather }
  if (!keys?.length) return base
  const t = Math.floor(Math.max(0, localMs) / MASK_STEP_MS) * MASK_STEP_MS
  if (t <= keys[0]!.ms) return pick(keys[0]!)
  const last = keys[keys.length - 1]!
  if (t >= last.ms) return pick(last)
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]!
    const b = keys[i + 1]!
    if (t >= a.ms && t < b.ms) {
      const u = (t - a.ms) / (b.ms - a.ms)
      const l = (p: number, q: number) => p + (q - p) * u
      return { x: l(a.x, b.x), y: l(a.y, b.y), w: l(a.w, b.w), h: l(a.h, b.h), rot: l(a.rot, b.rot), feather: l(a.feather, b.feather) }
    }
  }
  return pick(last)
}
const pick = (k: MaskKey): MaskGeom => ({ x: k.x, y: k.y, w: k.w, h: k.h, rot: k.rot, feather: k.feather })

export function maskGrid(W: number, H: number): { mw: number; mh: number } {
  const k = MASK_SHORT / Math.max(1, Math.min(W, H))
  return { mw: Math.max(2, Math.round(W * k)), mh: Math.max(2, Math.round(H * k)) }
}

/** Mask alpha (0–255, row-major mw × mh) for an export frame W × H. */
export function maskAlpha(shape: MaskShape, g: MaskGeom, invert: boolean, W: number, H: number): { mw: number; mh: number; alpha: Uint8Array } {
  const { mw, mh } = maskGrid(W, H)
  const alpha = new Uint8Array(mw * mh)
  const cx = (g.x / 100) * W
  const cy = (g.y / 100) * H
  const hw = (g.w / 100) * W * 0.5
  const hh = (g.h / 100) * H * 0.5
  const th = (g.rot * Math.PI) / 180
  const c = Math.cos(th)
  const s = Math.sin(th)
  const f = (g.feather / 100) * Math.min(W, H) * 0.25
  for (let j = 0; j < mh; j++) {
    const py = ((j + 0.5) * H) / mh
    for (let i = 0; i < mw; i++) {
      const px = ((i + 0.5) * W) / mw
      const dx = px - cx
      const dy = py - cy
      const u = dx * c + dy * s
      const v = -dx * s + dy * c
      let d: number
      if (shape === 'rect') {
        const qx = Math.abs(u) - hw
        const qy = Math.abs(v) - hh
        d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0)
      } else if (shape === 'ellipse') {
        d = (Math.hypot(u / hw, v / hh) - 1) * Math.min(hw, hh)
      } else if (shape === 'linear') {
        d = v
      } else {
        d = Math.abs(v) - hh
      }
      let m: number
      if (f > 0) {
        const t = Math.min(1, Math.max(0, (d + f / 2) / f))
        m = 1 - t * t * (3 - 2 * t)
      } else m = d <= 0 ? 1 : 0
      if (invert) m = 1 - m
      alpha[j * mw + i] = Math.floor(m * 255 + 0.5)
    }
  }
  return { mw, mh, alpha }
}

/** ffmpeg colorkey / despill parameters for a key (shared by the export and the WebGL mirror). */
export function chromaParams(k: ChromaKey): { rgb: [number, number, number]; similarity: number; blend: number; despill: null | { type: 0 | 1; amount: number } } {
  const n = parseInt(k.color.slice(1), 16)
  const rgb: [number, number, number] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  const similarity = Math.round((0.01 + (k.sim / 100) * 0.49) * 1e4) / 1e4
  const blend = Math.round((k.blend / 100) * 0.3 * 1e4) / 1e4
  const type: 0 | 1 = rgb[2] > rgb[1] ? 1 : 0
  const dominant = type === 1 ? rgb[2] > rgb[0] : rgb[1] > rgb[0] && rgb[1] >= rgb[2]
  const despill = k.spill > 0 && dominant ? { type, amount: Math.round((k.spill / 100) * 1e4) / 1e4 } : null
  return { rgb, similarity, blend, despill }
}

/**
 * CPU twin of ffmpeg 5.1 colorkey (alpha from the ungraded pixel) + despill (colour, float32) for
 * one 8-bit pixel — the same formula as the WebGL mirror (grade-gl.ts) and layer_fx.key_pixel.
 */
export function keyPixel(rgb: readonly [number, number, number], k: ChromaKey): { a: number; rgb: [number, number, number] } {
  const p = chromaParams(k)
  let [r, g, b] = rgb
  const diff = Math.sqrt(((r - p.rgb[0]) ** 2 + (g - p.rgb[1]) ** 2 + (b - p.rgb[2]) ** 2) / (255 * 255 * 3))
  const a = p.blend > 0.0001 ? Math.trunc(Math.min(1, Math.max(0, (diff - p.similarity) / p.blend)) * 255) : diff > p.similarity ? 255 : 0
  if (p.despill) {
    const f = Math.fround
    const rf = f(r / 255)
    let gf = f(g / 255)
    let bf = f(b / 255)
    const amt = f(-p.despill.amount)
    if (p.despill.type) {
      const sm = Math.max(f(bf - f(f(rf * 0.5) + f(gf * 0.5))), 0)
      bf = Math.max(f(bf + f(sm * amt)), 0)
    } else {
      const sm = Math.max(f(gf - f(f(rf * 0.5) + f(bf * 0.5))), 0)
      gf = Math.max(f(gf + f(sm * amt)), 0)
    }
    ;[r, g, b] = [rf, gf, bf].map((v) => Math.min(255, Math.max(0, Math.trunc(f(v * 255))))) as [number, number, number]
  }
  return { a, rgb: [r, g, b] }
}
