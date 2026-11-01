/**
 * E3 transitions: catalog, window math (cuts + B-roll) and the per-frame composite.
 *
 * The composite is defined by ffmpeg 5.1's vf_xfade.c (prod worker = Debian bookworm ffmpeg 5.1.x),
 * re-expressed as layer weights / geometry so the preview can draw it with CSS and
 * worker/clips_worker/motion.py can predict export pixels (frame-sample parity test).
 *
 * Progress: q = (t − w0) / (w1 − w0) ∈ [0, 1] (0 = all outgoing A); xfade's P = 1 − q.
 * Durations never change the output length: a cut transition is CENTRED on the cut and uses
 * handle frames (A continues past its out-point, B starts before its in-point), video only —
 * audio, captions, B-roll and SFX timings are untouched.
 */
import type { BrollItem } from '@/lib/clips/broll'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import {
  MOTION_FPS,
  TRANSITION_DEFAULT_MS,
  TRANSITION_MAX_MS,
  TRANSITION_MIN_MS,
  TRANSITION_TYPES,
  type CutTransition,
  type TransitionSpec,
  type TransitionType,
} from '@/lib/clips/editor/motion-schema'

export type TransitionGroup = 'Basic' | 'Push' | 'Wipe' | 'Zoom & blur' | 'Soft wipe' | 'Shape' | 'Slice' | 'Slide' | 'Stylized'
export type TransitionInfo = { type: TransitionType; label: string; group: TransitionGroup; xfade: string }

/** xfade names verified present in ffmpeg 5.1 (`ffmpeg -h filter=xfade`). Zoom in/out = scale + fade. */
export const TRANSITIONS: TransitionInfo[] = [
  { type: 'crossfade', label: 'Crossfade', group: 'Basic', xfade: 'fade' },
  { type: 'dip_black', label: 'Dip to black', group: 'Basic', xfade: 'fadeblack' },
  { type: 'dip_white', label: 'Dip to white', group: 'Basic', xfade: 'fadewhite' },
  { type: 'push_left', label: 'Push left', group: 'Push', xfade: 'slideleft' },
  { type: 'push_right', label: 'Push right', group: 'Push', xfade: 'slideright' },
  { type: 'push_up', label: 'Push up', group: 'Push', xfade: 'slideup' },
  { type: 'push_down', label: 'Push down', group: 'Push', xfade: 'slidedown' },
  { type: 'wipe_left', label: 'Wipe left', group: 'Wipe', xfade: 'wipeleft' },
  { type: 'wipe_right', label: 'Wipe right', group: 'Wipe', xfade: 'wiperight' },
  { type: 'wipe_up', label: 'Wipe up', group: 'Wipe', xfade: 'wipeup' },
  { type: 'wipe_down', label: 'Wipe down', group: 'Wipe', xfade: 'wipedown' },
  { type: 'zoom_in', label: 'Zoom in', group: 'Zoom & blur', xfade: 'fade' },
  { type: 'zoom_out', label: 'Zoom out', group: 'Zoom & blur', xfade: 'fade' },
  { type: 'blur', label: 'Blur', group: 'Zoom & blur', xfade: 'hblur' },
  // G4b — per-pixel mask transitions (xfadeBWeight = vf_xfade.c 5.1, checked against real ffmpeg).
  { type: 'wipe_tl', label: 'Wipe ↖', group: 'Wipe', xfade: 'wipetl' },
  { type: 'wipe_tr', label: 'Wipe ↗', group: 'Wipe', xfade: 'wipetr' },
  { type: 'wipe_bl', label: 'Wipe ↙', group: 'Wipe', xfade: 'wipebl' },
  { type: 'wipe_br', label: 'Wipe ↘', group: 'Wipe', xfade: 'wipebr' },
  { type: 'smooth_left', label: 'Soft left', group: 'Soft wipe', xfade: 'smoothleft' },
  { type: 'smooth_right', label: 'Soft right', group: 'Soft wipe', xfade: 'smoothright' },
  { type: 'smooth_up', label: 'Soft up', group: 'Soft wipe', xfade: 'smoothup' },
  { type: 'smooth_down', label: 'Soft down', group: 'Soft wipe', xfade: 'smoothdown' },
  { type: 'diag_tl', label: 'Diagonal ↖', group: 'Soft wipe', xfade: 'diagtl' },
  { type: 'diag_tr', label: 'Diagonal ↗', group: 'Soft wipe', xfade: 'diagtr' },
  { type: 'diag_bl', label: 'Diagonal ↙', group: 'Soft wipe', xfade: 'diagbl' },
  { type: 'diag_br', label: 'Diagonal ↘', group: 'Soft wipe', xfade: 'diagbr' },
  { type: 'circle_open', label: 'Circle open', group: 'Shape', xfade: 'circleopen' },
  { type: 'circle_close', label: 'Circle close', group: 'Shape', xfade: 'circleclose' },
  { type: 'vert_open', label: 'Doors open', group: 'Shape', xfade: 'vertopen' },
  { type: 'vert_close', label: 'Doors close', group: 'Shape', xfade: 'vertclose' },
  { type: 'horz_open', label: 'Bars open', group: 'Shape', xfade: 'horzopen' },
  { type: 'horz_close', label: 'Bars close', group: 'Shape', xfade: 'horzclose' },
  { type: 'radial', label: 'Clock', group: 'Shape', xfade: 'radial' },
  { type: 'slice_left', label: 'Slices left', group: 'Slice', xfade: 'hlslice' },
  { type: 'slice_right', label: 'Slices right', group: 'Slice', xfade: 'hrslice' },
  { type: 'slice_up', label: 'Slices up', group: 'Slice', xfade: 'vuslice' },
  { type: 'slice_down', label: 'Slices down', group: 'Slice', xfade: 'vdslice' },
  { type: 'pixelize', label: 'Pixelize', group: 'Stylized', xfade: 'pixelize' },
  { type: 'fade_grays', label: 'Fade to gray', group: 'Stylized', xfade: 'fadegrays' },
  { type: 'squeeze_h', label: 'Squeeze vertical', group: 'Stylized', xfade: 'squeezeh' },
  { type: 'squeeze_v', label: 'Squeeze horizontal', group: 'Stylized', xfade: 'squeezev' },
  { type: 'cover_left', label: 'Cover ←', group: 'Slide', xfade: 'overlay' },
  { type: 'cover_right', label: 'Cover →', group: 'Slide', xfade: 'overlay' },
  { type: 'cover_up', label: 'Cover ↑', group: 'Slide', xfade: 'overlay' },
  { type: 'cover_down', label: 'Cover ↓', group: 'Slide', xfade: 'overlay' },
  { type: 'reveal_left', label: 'Reveal ←', group: 'Slide', xfade: 'overlay' },
  { type: 'reveal_right', label: 'Reveal →', group: 'Slide', xfade: 'overlay' },
  { type: 'reveal_up', label: 'Reveal ↑', group: 'Slide', xfade: 'overlay' },
  { type: 'reveal_down', label: 'Reveal ↓', group: 'Slide', xfade: 'overlay' },
]
/** G4b: transitions drawn with a per-pixel mask on the top layer (explicit list — not index-based). */
export const G4B_MASK_TRANSITION_TYPES = [
  'smooth_left',
  'smooth_right',
  'smooth_up',
  'smooth_down',
  'circle_open',
  'circle_close',
  'vert_open',
  'vert_close',
  'horz_open',
  'horz_close',
  'radial',
  'diag_tl',
  'diag_tr',
  'diag_bl',
  'diag_br',
  'slice_left',
  'slice_right',
  'slice_up',
  'slice_down',
  'wipe_tl',
  'wipe_tr',
  'wipe_bl',
  'wipe_br',
] as const satisfies readonly TransitionType[]
export const MASK_TRANSITIONS: ReadonlySet<TransitionType> = new Set(G4B_MASK_TRANSITION_TYPES)
/** TR-04: cut-only transitions (no B-roll edges; stale data skipped in window builders). */
export const CUT_ONLY_TRANSITIONS: ReadonlySet<TransitionType> = new Set([
  'pixelize',
  'fade_grays',
  'squeeze_h',
  'squeeze_v',
  'cover_left',
  'cover_right',
  'cover_up',
  'cover_down',
  'reveal_left',
  'reveal_right',
  'reveal_up',
  'reveal_down',
])
/** Corner wipes are hard rectangles: drawn with an exact clip-path instead of a mask image. */
const CORNER: Partial<Record<TransitionType, 'tl' | 'tr' | 'bl' | 'br'>> = { wipe_tl: 'tl', wipe_tr: 'tr', wipe_bl: 'bl', wipe_br: 'br' }
export const TRANSITION_INFO = Object.fromEntries(TRANSITIONS.map((t) => [t.type, t])) as Record<TransitionType, TransitionInfo>
/** Zoom transitions scale the zooming layer 1 → 1 + ZOOM_AMOUNT. */
export const ZOOM_AMOUNT = 0.5

// ---------------------------------------------------------------------------
// Per-frame composite (exactly vf_xfade.c 5.1 for each mapped transition)
// ---------------------------------------------------------------------------

export type LayerGeom = {
  /** translate, fraction of frame W / H */
  tx: number
  ty: number
  scale: number
  /** scale axes for squeeze transitions (default 1) */
  sx?: number
  sy?: number
  /** visible inset rect, fractions (top, right, bottom, left) — null = whole frame */
  clip: [number, number, number, number] | null
}
export type TransitionFrame = {
  /** blend weights of A, B and the dip colour (sum 1). Push / wipe are geometric: wA = wB = 1, wC = 0. */
  wA: number
  wB: number
  wC: number
  color: 'black' | 'white' | null
  geometric: boolean
  a: LayerGeom
  b: LayerGeom
  /** horizontal box-blur width as a fraction of frame W (xfade hblur); 0 = none */
  blurFrac: number
  /** G4b: per-pixel mask transition (xfade name + xfade progress P = 1 − q) */
  mask?: { xfade: string; P: number }
  /** which layer is on top in the DOM stack (cover / reveal / squeeze) */
  top?: 'a' | 'b'
  /** fade_grays: Rec.709 luma mix via CSS saturate on each clone */
  satA?: number
  satB?: number
  /** pixelize: block size as fraction of min(W,H); omitted when dist = 0 */
  pixel?: { blockFrac: number; P: number }
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

const G0 = (): LayerGeom => ({ tx: 0, ty: 0, scale: 1, clip: null })

export function transitionFrame(type: TransitionType, qIn: number): TransitionFrame {
  const q = Math.min(1, Math.max(0, qIn))
  const P = 1 - q
  const f: TransitionFrame = { wA: P, wB: q, wC: 0, color: null, geometric: false, a: G0(), b: G0(), blurFrac: 0 }
  if (MASK_TRANSITIONS.has(type)) return { ...f, wA: 1, wB: 1, geometric: true, mask: { xfade: TRANSITION_INFO[type].xfade, P: Math.fround(1 - Math.fround(q)) } }
  switch (type) {
    case 'crossfade':
      return f
    case 'dip_black':
    case 'dip_white': {
      const s1 = smoothstep(0.8, 1, P)
      const s2 = smoothstep(0.2, 1, P)
      const wA = s1 * P
      const wB = (1 - s2) * (1 - P)
      return { ...f, wA, wB, wC: Math.max(0, 1 - wA - wB), color: type === 'dip_black' ? 'black' : 'white' }
    }
    case 'push_left':
      return { ...f, wA: 1, wB: 1, geometric: true, a: { ...G0(), tx: -q }, b: { ...G0(), tx: P } }
    case 'push_right':
      return { ...f, wA: 1, wB: 1, geometric: true, a: { ...G0(), tx: q }, b: { ...G0(), tx: -P } }
    case 'push_up':
      return { ...f, wA: 1, wB: 1, geometric: true, a: { ...G0(), ty: -q }, b: { ...G0(), ty: P } }
    case 'push_down':
      return { ...f, wA: 1, wB: 1, geometric: true, a: { ...G0(), ty: q }, b: { ...G0(), ty: -P } }
    case 'wipe_left': // B where x > P·W
      return { ...f, wA: 1, wB: 1, geometric: true, b: { ...G0(), clip: [0, 0, 0, P] } }
    case 'wipe_right': // B where x ≤ q·W
      return { ...f, wA: 1, wB: 1, geometric: true, b: { ...G0(), clip: [0, 1 - q, 0, 0] } }
    case 'wipe_up': // B where y > P·H
      return { ...f, wA: 1, wB: 1, geometric: true, b: { ...G0(), clip: [P, 0, 0, 0] } }
    case 'wipe_down': // B where y ≤ q·H
      return { ...f, wA: 1, wB: 1, geometric: true, b: { ...G0(), clip: [0, 0, 1 - q, 0] } }
    case 'zoom_in':
      return { ...f, a: { ...G0(), scale: 1 + ZOOM_AMOUNT * q } }
    case 'zoom_out':
      return { ...f, b: { ...G0(), scale: 1 + ZOOM_AMOUNT * P } }
    case 'blur': {
      const prog = P <= 0.5 ? P * 2 : (1 - P) * 2
      return { ...f, blurFrac: prog / 2 }
    }
    case 'squeeze_h':
      return { ...f, wA: 1, wB: 1, geometric: true, a: { ...G0(), sy: P }, top: 'a' }
    case 'squeeze_v':
      return { ...f, wA: 1, wB: 1, geometric: true, a: { ...G0(), sx: P }, top: 'a' }
    case 'cover_left':
      return { ...f, wA: 1, wB: 1, geometric: true, b: { ...G0(), tx: P }, top: 'b' }
    case 'cover_right':
      return { ...f, wA: 1, wB: 1, geometric: true, b: { ...G0(), tx: -P }, top: 'b' }
    case 'cover_up':
      return { ...f, wA: 1, wB: 1, geometric: true, b: { ...G0(), ty: P }, top: 'b' }
    case 'cover_down':
      return { ...f, wA: 1, wB: 1, geometric: true, b: { ...G0(), ty: -P }, top: 'b' }
    case 'reveal_left':
      return { ...f, wA: 1, wB: 1, geometric: true, a: { ...G0(), tx: -q }, top: 'a' }
    case 'reveal_right':
      return { ...f, wA: 1, wB: 1, geometric: true, a: { ...G0(), tx: q }, top: 'a' }
    case 'reveal_up':
      return { ...f, wA: 1, wB: 1, geometric: true, a: { ...G0(), ty: -q }, top: 'a' }
    case 'reveal_down':
      return { ...f, wA: 1, wB: 1, geometric: true, a: { ...G0(), ty: q }, top: 'a' }
    case 'fade_grays': {
      const s1 = smoothstep(0.8, 1, P)
      const s2 = smoothstep(0.2, 1, P)
      return { ...f, satA: s1, satB: 1 - s2 }
    }
    case 'pixelize': {
      const d = Math.min(P, 1 - P)
      const dist = Math.ceil(d * 50) / 50
      if (dist <= 0) return f
      const blockFrac = (2 * dist) / 20
      return { ...f, pixel: { blockFrac, P } }
    }
    default:
      return f
  }
}

// ---------------------------------------------------------------------------
// G4b mask transitions: the weight of input B, exactly vf_xfade.c 5.1 (float math; W × H = export
// frame, x / y = export pixel). Mirrored by clips_worker/xfade_masks.py (checked against ffmpeg).
// ---------------------------------------------------------------------------

const f32 = Math.fround
function ss32(e0: number, e1: number, x: number): number {
  const t = f32(Math.min(1, Math.max(0, f32(f32(x - e0) / (e1 - e0)))))
  return f32(f32(t * t) * f32(3 - 2 * t))
}
const fract = (a: number) => f32(a - Math.floor(a))

/** xfade progress at frame k of an n-frame window (float32: 1 − pts / duration). */
export function windowProgress(k: number, n: number): number {
  return f32(1 - f32(f32(k) / f32(n)))
}

export function xfadeBWeight(name: string, P: number, x: number, y: number, W: number, H: number): number {
  const p2 = f32(P * 2)
  switch (name) {
    case 'smoothleft':
      return ss32(0, 1, f32(f32(1 + f32(x / W)) - p2))
    case 'smoothright':
      return ss32(0, 1, f32(f32(1 + f32((W - 1 - x) / W)) - p2))
    case 'smoothup':
      return ss32(0, 1, f32(f32(1 + f32(y / H)) - p2))
    case 'smoothdown':
      return ss32(0, 1, f32(f32(1 + f32((H - 1 - y) / H)) - p2))
    case 'circleopen':
    case 'circleclose': {
      const hw = Math.trunc(W / 2)
      const hh = Math.trunc(H / 2)
      const z = f32(Math.hypot(hw, hh))
      const d = f32(f32(Math.hypot(x - hw, y - hh)) / z)
      return name === 'circleopen' ? 1 - ss32(0, 1, f32(d + f32(f32(P - 0.5) * 3))) : ss32(0, 1, f32(d + f32(f32(1 - P - 0.5) * 3)))
    }
    case 'vertopen':
    case 'vertclose':
    case 'horzopen':
    case 'horzclose': {
      const vert = name.startsWith('vert')
      const c = (vert ? W : H) / 2
      const a = f32(Math.abs(f32(((vert ? x : y) - c) / c)))
      const base = name.endsWith('open') ? f32(2 - a) : f32(1 + a)
      return ss32(0, 1, f32(base - p2))
    }
    case 'radial': {
      const ang = f32(Math.atan2(x - Math.trunc(W / 2), y - Math.trunc(H / 2)))
      return ss32(0, 1, f32(ang - f32(f32(P - 0.5) * f32(Math.PI * 2.5))))
    }
    case 'diagtl':
    case 'diagtr':
    case 'diagbl':
    case 'diagbr': {
      const xx = name === 'diagtl' || name === 'diagbl' ? f32(x / W) : f32((W - 1 - x) / W)
      const yy = name === 'diagtl' || name === 'diagtr' ? f32(y / H) : f32((H - 1 - y) / H)
      return ss32(0, 1, f32(f32(1 + f32(xx * yy)) - p2))
    }
    case 'hlslice':
    case 'hrslice':
    case 'vuslice':
    case 'vdslice': {
      let v: number
      let ten: number
      if (name === 'hlslice') {
        v = f32(x / W)
        ten = f32(f32(10 * x) / W)
      } else if (name === 'hrslice') {
        v = f32((W - 1 - x) / W)
        ten = f32(10 * v)
      } else if (name === 'vuslice') {
        v = f32(y / H)
        ten = f32(f32(10 * y) / H)
      } else {
        v = f32((H - 1 - y) / H)
        ten = f32(10 * v)
      }
      const s = ss32(-0.5, 0, f32(v - f32(P * 1.5)))
      return s <= fract(ten) ? 0 : 1
    }
    case 'wipetl':
      return y <= Math.trunc(f32(H * P)) && x <= Math.trunc(f32(W * P)) ? 0 : 1
    case 'wipetr':
      return y <= Math.trunc(f32(H * P)) && x > Math.trunc(f32(W * f32(1 - P))) ? 0 : 1
    case 'wipebl':
      return y > Math.trunc(f32(H * f32(1 - P))) && x <= Math.trunc(f32(W * P)) ? 0 : 1
    case 'wipebr':
      return y > Math.trunc(f32(H * f32(1 - P))) && x > Math.trunc(f32(W * f32(1 - P))) ? 0 : 1
  }
  return 0
}

/** Mask image size used by the preview (export pixels are sampled at the cell centres). */
export function maskGridSize(xfade: string, W: number, H: number): { mw: number; mh: number } {
  // Slices: 10 bands per axis (≥ 24 mask px each); soft masks are smooth.
  const short = xfade.endsWith('slice') ? 240 : 180
  const k = short / Math.max(1, Math.min(W, H))
  return { mw: Math.max(8, Math.round(W * k)), mh: Math.max(8, Math.round(H * k)) }
}

/** 8-bit alpha of the TOP layer for the mask transition (row-major mw × mh). */
export function transitionMaskAlpha(xfade: string, P: number, top: 'A' | 'B', W: number, H: number): { mw: number; mh: number; alpha: Uint8ClampedArray } {
  const { mw, mh } = maskGridSize(xfade, W, H)
  const alpha = new Uint8ClampedArray(mw * mh)
  for (let j = 0; j < mh; j++) {
    const y = Math.min(H - 1, Math.max(0, Math.round(((j + 0.5) * H) / mh - 0.5)))
    for (let i = 0; i < mw; i++) {
      const x = Math.min(W - 1, Math.max(0, Math.round(((i + 0.5) * W) / mw - 0.5)))
      const wb = xfadeBWeight(xfade, P, x, y, W, H)
      alpha[j * mw + i] = Math.round((top === 'B' ? wb : 1 - wb) * 255)
    }
  }
  return { mw, mh, alpha }
}

/** Exact corner-wipe region of A (fractions of the frame: x0, y0, x1, y1). */
export function cornerRectA(c: 'tl' | 'tr' | 'bl' | 'br', P: number): [number, number, number, number] {
  const q = 1 - P
  if (c === 'tl') return [0, 0, P, P]
  if (c === 'tr') return [q, 0, 1, P]
  if (c === 'bl') return [0, q, P, 1]
  return [q, q, 1, 1]
}

/** Complement of a wipe clip (the region the OTHER layer shows). */
function complementClip(c: [number, number, number, number]): [number, number, number, number] {
  const [t, r, b, l] = c
  if (l > 0) return [0, 1 - l, 0, 0]
  if (r > 0) return [0, 0, 0, 1 - r]
  if (t > 0) return [0, 0, 1 - t, 0]
  if (b > 0) return [1 - b, 0, 0, 0]
  return [0, 0, 0, 0]
}

export type LayerCss = {
  opacity: number
  transform: string
  clipPath: string
  filter: string
  visibility: 'visible' | 'hidden'
  /** G4b: mask-transition key `xfade|P|A·B` (top layer only; motion-preview draws the mask image) */
  mask?: string
}

const pct = (n: number) => `${Math.round(n * 1e5) / 1e3}%`

function layerCss(g: LayerGeom, opacity: number, clip: [number, number, number, number] | null, blurPx: number, extraFilter = ''): LayerCss {
  const tf = []
  if (g.tx || g.ty) tf.push(`translate(${pct(g.tx)}, ${pct(g.ty)})`)
  const sx = g.sx ?? 1
  const sy = g.sy ?? 1
  if (sx !== 1 || sy !== 1) tf.push(`scale(${Math.round(sx * 1e5) / 1e5}, ${Math.round(sy * 1e5) / 1e5})`)
  else if (g.scale !== 1) tf.push(`scale(${Math.round(g.scale * 1e5) / 1e5})`)
  const fl = [blurPx > 0.05 ? `blur(${Math.round(blurPx * 100) / 100}px)` : '', extraFilter].filter(Boolean).join(' ')
  return {
    opacity: Math.round(opacity * 1e5) / 1e5,
    transform: tf.join(' '),
    clipPath: clip ? `inset(${pct(clip[0])} ${pct(clip[1])} ${pct(clip[2])} ${pct(clip[3])})` : '',
    filter: fl,
    visibility: opacity <= 0 ? 'hidden' : 'visible',
  }
}

/**
 * Two stacked full-frame layers (+ an optional colour layer between them) reproducing the frame.
 * Bottom layer is opaque; top opacity = w_top; colour opacity = wC / (1 − w_top). Then
 * top·w_top + colour·wC + bottom·(1 − w_top − wC) = the xfade blend.
 * `aTop`: which of A / B the DOM stacks on top. `displayW`: px width of the stage (blur scale).
 */
export function compositeCss(
  f: TransitionFrame,
  aTop: boolean,
  displayW: number,
): { a: LayerCss; b: LayerCss; color: { opacity: number; background: string }; top: 'a' | 'b' } {
  const stackTop = f.top ?? (aTop ? 'a' : 'b')
  const satA = f.satA != null ? `saturate(${Math.round(f.satA * 1e5) / 1e5})` : ''
  const satB = f.satB != null ? `saturate(${Math.round(f.satB * 1e5) / 1e5})` : ''
  // Box blur of width s ≈ gaussian σ = s/√12.
  const blurPx = (f.blurFrac * displayW) / Math.sqrt(12)
  if (f.mask) {
    const { xfade, P } = f.mask
    const a = layerCss(f.a, 1, null, 0, satA)
    const b = layerCss(f.b, 1, null, 0, satB)
    const top = stackTop === 'a' ? a : b
    const corner = CORNER[TRANSITIONS.find((t) => t.xfade === xfade)?.type as TransitionType]
    if (corner) {
      const [x0, y0, x1, y1] = cornerRectA(corner, P)
      if (stackTop === 'a') top.clipPath = `inset(${pct(y0)} ${pct(1 - x1)} ${pct(1 - y1)} ${pct(x0)})`
      else
        top.clipPath = `polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${pct(x0)} ${pct(y0)}, ${pct(x1)} ${pct(y0)}, ${pct(x1)} ${pct(y1)}, ${pct(x0)} ${pct(y1)}, ${pct(x0)} ${pct(y0)})`
    } else top.mask = `${xfade}|${Math.round(P * 1e6) / 1e6}|${stackTop === 'a' ? 'A' : 'B'}`
    return { a, b, color: { opacity: 0, background: 'transparent' }, top: stackTop }
  }
  if (f.geometric) {
    let aClip = f.a.clip
    let bClip = f.b.clip
    if (stackTop === 'a' && bClip) {
      aClip = complementClip(bClip)
      bClip = null
    } else if (stackTop === 'b' && aClip) {
      bClip = complementClip(aClip)
      aClip = null
    }
    return {
      a: layerCss(f.a, 1, aClip, 0, satA),
      b: layerCss(f.b, 1, bClip, 0, satB),
      color: { opacity: 0, background: 'transparent' },
      top: stackTop,
    }
  }
  const wTop = stackTop === 'a' ? f.wA : f.wB
  const colorOp = f.wC > 0 && wTop < 1 - 1e-6 ? f.wC / (1 - wTop) : 0
  const topOp = wTop
  return {
    a: layerCss(f.a, stackTop === 'a' ? topOp : 1, null, blurPx, satA),
    b: layerCss(f.b, stackTop === 'b' ? topOp : 1, null, blurPx, satB),
    color: { opacity: Math.round(colorOp * 1e5) / 1e5, background: f.color === 'white' ? '#fff' : '#000' },
    top: stackTop,
  }
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

export type CutWindow = {
  /** index of the segment AFTER the cut */
  k: number
  srcMs: number
  type: TransitionType
  durMs: number
  /** output ms of the cut */
  cutMs: number
  w0Ms: number
  w1Ms: number
  startFrame: number
  frames: number
  /** A = outgoing segment continued: source ms = aEnd + (t − cutMs). B = incoming: bStart + (t − cutMs). */
  aEnd: number
  bStart: number
}

const frameMs = (fps: number) => 1000 / fps

function clampDur(d: number): number {
  return Math.min(TRANSITION_MAX_MS, Math.max(TRANSITION_MIN_MS, Math.round(d)))
}

/** E3fix2: a transition belongs to a cut when its srcMs is within half an export frame. */
export function cutMatchToleranceMs(fps = MOTION_FPS): number {
  return 500 / (fps || MOTION_FPS)
}

/**
 * E3fix2 (mirror of motion.match_transitions_to_cuts): cut index k → transition. Each transition
 * goes to its NEAREST cut start (segs[k][0], k ≥ 1; ties → earlier cut) when within half a frame;
 * each cut keeps its nearest claimant (ties → first in the list). Was |srcMs − cut| ≤ 1 ms.
 */
export function matchTransitionsToCuts<T extends { srcMs: number }>(
  segs: readonly (readonly [number, number])[],
  transitions: readonly T[] | undefined,
  fps = MOTION_FPS,
): Map<number, T> {
  const tol = cutMatchToleranceMs(fps)
  const best = new Map<number, { delta: number; tr: T }>()
  if (!transitions?.length || segs.length < 2) return new Map()
  for (const tr of transitions) {
    let bk = -1
    let bd = Infinity
    for (let k = 1; k < segs.length; k++) {
      const d = Math.abs(tr.srcMs - segs[k]![0])
      if (d < bd) {
        bd = d
        bk = k
      }
    }
    if (bk < 0 || bd > tol) continue
    const cur = best.get(bk)
    if (!cur || bd < cur.delta) best.set(bk, { delta: bd, tr })
  }
  return new Map([...best].map(([k, v]) => [k, v.tr]))
}

/** E3fix2: the transition shown for the cut whose next segment starts at `cutSrcMs`. */
export function transitionAtCut<T extends { srcMs: number }>(
  segs: readonly (readonly [number, number])[],
  transitions: readonly T[] | undefined,
  cutSrcMs: number,
  fps = MOTION_FPS,
): T | undefined {
  const k = segs.findIndex(([a], i) => i > 0 && a === cutSrcMs)
  return k > 0 ? matchTransitionsToCuts(segs, transitions, fps).get(k) : undefined
}

/**
 * Cut windows on the effective EDL. segs/starts = timebaseFor(editorPreviewEdits(...)).
 * d ≤ min(len before, len after) so neighbouring windows never overlap (each segment gives at
 * most half its length to each side); windows snap to the export frame grid.
 */
export function cutTransitionWindows(
  segs: [number, number][],
  starts: number[],
  transitions: readonly CutTransition[] | undefined,
  fps = MOTION_FPS,
): CutWindow[] {
  if (!transitions?.length || segs.length < 2) return []
  const out: CutWindow[] = []
  let lastEndFrame = 0
  const byCut = matchTransitionsToCuts(segs, transitions, fps)
  for (let k = 1; k < segs.length; k++) {
    const [a0, a1] = segs[k - 1]!
    const [b0, b1] = segs[k]!
    const tr = byCut.get(k)
    if (!tr) continue
    const d = Math.min(clampDur(tr.durMs), a1 - a0, b1 - b0)
    if (d < TRANSITION_MIN_MS) continue
    const cut = starts[k]!
    const frames = Math.max(2, Math.round((d * fps) / 1000))
    let startFrame = Math.round(((cut - d / 2) * fps) / 1000)
    startFrame = Math.max(startFrame, lastEndFrame, 0)
    let n = frames
    const maxEnd = Math.floor(((starts[k]! + (b1 - b0)) * fps) / 1000)
    if (startFrame + n > maxEnd) n = maxEnd - startFrame
    if (n < 2) continue
    lastEndFrame = startFrame + n
    out.push({
      k,
      srcMs: b0,
      type: tr.type,
      durMs: d,
      cutMs: cut,
      w0Ms: startFrame * frameMs(fps),
      w1Ms: (startFrame + n) * frameMs(fps),
      startFrame,
      frames: n,
      aEnd: a1,
      bStart: b0,
    })
  }
  return out
}

export type BrollWindow = {
  itemId: string
  kind: 'in' | 'out' | 'between'
  /** for 'between': the outgoing item (continues past its end during the window) */
  fromId: string | null
  type: TransitionType
  w0Ms: number
  w1Ms: number
  startFrame: number
  frames: number
}

/** Adjacent when the next item starts within one export frame of this one's end. */
export function brollAdjacent(a: Pick<BrollItem, 'endMs'>, b: Pick<BrollItem, 'startMs'>, fps = MOTION_FPS): boolean {
  return Math.abs(b.startMs - a.endMs) <= frameMs(fps) + 0.5
}

/**
 * B-roll windows stay inside the item: in = [start, start+d], out = [end−d, end],
 * between (item starts where the previous ends) = [start, start+d] with the previous item continuing.
 */
export function brollTransitionWindows(broll: readonly BrollItem[] | undefined, fps = MOTION_FPS): BrollWindow[] {
  const items = [...(broll ?? [])].sort((a, b) => a.startMs - b.startMs)
  const out: BrollWindow[] = []
  items.forEach((it, i) => {
    const len = it.endMs - it.startMs
    const prev = i > 0 ? items[i - 1]! : null
    const nxt = i < items.length - 1 ? items[i + 1]! : null
    const mk = (spec: TransitionSpec, kind: BrollWindow['kind'], atStart: boolean, fromId: string | null) => {
      if (CUT_ONLY_TRANSITIONS.has(spec.type)) return
      const d = Math.min(clampDur(spec.durMs), len / 2)
      if (d < TRANSITION_MIN_MS) return
      const n = Math.max(2, Math.round((d * fps) / 1000))
      const startFrame = atStart
        ? Math.round((it.startMs * fps) / 1000)
        : Math.round((it.endMs * fps) / 1000) - n
      out.push({ itemId: it.id, kind, fromId, type: spec.type, w0Ms: startFrame * frameMs(fps), w1Ms: (startFrame + n) * frameMs(fps), startFrame, frames: n })
    }
    if (it.transitionIn) {
      const between = prev && brollAdjacent(prev, it, fps)
      mk(it.transitionIn, between ? 'between' : 'in', true, between ? prev!.id : null)
    }
    if (it.transitionOut && !(nxt && brollAdjacent(it, nxt, fps))) mk(it.transitionOut, 'out', false, null)
  })
  return out
}

/** Output range during which a B-roll item is visible (extended while it feeds a 'between' window). */
export function brollVisibleRange(item: BrollItem, windows: readonly BrollWindow[]): [number, number] {
  let end = item.endMs
  for (const w of windows) if (w.kind === 'between' && w.fromId === item.id) end = Math.max(end, w.w1Ms)
  return [item.startMs, end]
}

export function progressIn(w: { w0Ms: number; w1Ms: number }, outMs: number): number {
  return Math.min(1, Math.max(0, (outMs - w.w0Ms) / Math.max(1e-6, w.w1Ms - w.w0Ms)))
}

// ---------------------------------------------------------------------------
// Edit operations
// ---------------------------------------------------------------------------

export function setCutTransition(edits: ClipEditsV2, srcMs: number, spec: TransitionSpec | null): ClipEditsV2 {
  const rest = (edits.transitions ?? []).filter((t) => Math.abs(t.srcMs - srcMs) > cutMatchToleranceMs())
  const list = spec ? [...rest, { srcMs: Math.round(srcMs), type: spec.type, durMs: clampDur(spec.durMs) }] : rest
  list.sort((a, b) => a.srcMs - b.srcMs)
  return { ...edits, transitions: list.length ? list : undefined }
}

/** "Apply to all" (CapCut / Descript): the same transition on every cut of the effective EDL. */
export function applyCutTransitionToAll(edits: ClipEditsV2, segs: [number, number][], spec: TransitionSpec | null): ClipEditsV2 {
  if (!spec) return { ...edits, transitions: undefined }
  const list = segs.slice(1).map(([b0]) => ({ srcMs: b0, type: spec.type, durMs: clampDur(spec.durMs) }))
  return { ...edits, transitions: list.length ? list : undefined }
}

export function setBrollTransition(
  edits: ClipEditsV2,
  id: string,
  edge: 'in' | 'out',
  spec: TransitionSpec | null,
): ClipEditsV2 {
  const key = edge === 'in' ? 'transitionIn' : 'transitionOut'
  return {
    ...edits,
    broll: (edits.broll ?? []).map((b) => {
      if (b.id !== id) return b
      const { [key]: _drop, ...rest } = b as BrollItem & Record<string, unknown>
      return (spec ? { ...rest, [key]: { type: spec.type, durMs: clampDur(spec.durMs) } } : rest) as BrollItem
    }),
  }
}

export function applyBrollTransitionToAll(edits: ClipEditsV2, spec: TransitionSpec | null): ClipEditsV2 {
  return {
    ...edits,
    broll: (edits.broll ?? []).map((b) => {
      const { transitionIn: _i, transitionOut: _o, ...rest } = b as BrollItem
      return (spec
        ? { ...rest, transitionIn: { type: spec.type, durMs: clampDur(spec.durMs) }, transitionOut: { type: spec.type, durMs: clampDur(spec.durMs) } }
        : rest) as BrollItem
    }),
  }
}

/**
 * Keep cut transitions on their cut when an edge of the following segment is trimmed (its source
 * start moves but its end stays). Transitions whose cut disappeared are dropped.
 */
export function remapCutTransitions(
  transitions: CutTransition[] | undefined,
  prevSegs: [number, number][],
  nextSegs: [number, number][],
): CutTransition[] | undefined {
  if (!transitions?.length) return transitions
  const starts = new Set(nextSegs.slice(1).map(([a]) => a))
  let changed = false
  const out: CutTransition[] = []
  const tol = cutMatchToleranceMs()
  for (const t of transitions) {
    // E3fix2: within half a frame (was 1 ms) — and snap the key onto the cut it belongs to.
    const hit = [...starts].find((s) => Math.abs(s - t.srcMs) <= tol)
    if (hit !== undefined) {
      if (hit !== t.srcMs) changed = true
      out.push(hit === t.srcMs ? t : { ...t, srcMs: hit })
      continue
    }
    changed = true
    const old = prevSegs.find(([a]) => Math.abs(a - t.srcMs) <= tol)
    const moved = old ? nextSegs.slice(1).find(([, b]) => b === old[1]) : undefined
    if (moved) out.push({ ...t, srcMs: moved[0] })
  }
  if (!changed) return transitions
  return out.length ? out : undefined
}

export { TRANSITION_DEFAULT_MS, TRANSITION_MAX_MS, TRANSITION_MIN_MS, TRANSITION_TYPES }
export type { CutTransition, TransitionSpec, TransitionType }
