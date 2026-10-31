/**
 * G3b: shapes, stickers and progress bars on the Text lane — ASS vector drawings (\p1).
 * Byte-identical TS port of worker/clips_worker/text_shapes.py + text_shapes_ass.py (goldens in
 * worker/tests/fixtures/render_plan). text-shapes.json is the SAME file as the worker's
 * text_shapes.json (asserted by tests): every drawing sits in a 1000 x 1000 unit box scaled to the
 * item's px size; each part starts with `m 0 0 m W H` so all parts anchor on one box (\an5 = centre).
 */
import LIB from '@/lib/clips/render-plan/text-shapes.json'
import { hasMotionPy, layerTransformAtPy, MOTION_FPS, type Track } from '@/lib/clips/render-plan/motion'
import { fitDurations, frameAnim, normLayerAnim } from '@/lib/clips/render-plan/text-anim'
import { hex2, pyFloatStr, pyRound, pyRoundN } from '@/lib/clips/render-plan/py'

type Dict = Record<string, unknown>
const isDict = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v)

export const SHAPE_KINDS = ['shape', 'sticker', 'progress'] as const
export type ShapeKind = (typeof SHAPE_KINDS)[number]
export const SHAPE_MIN = 8
export const SHAPE_MAX = 3840
export const PROGRESS_H_MIN = 2
export const PROGRESS_H_MAX = 120
export const PROGRESS_W_MIN = 10
export const PROGRESS_W_MAX = 100
const PROGRESS_CLIP_PAD = 2

type Lib = {
  version: number
  shapes: Record<string, { label: string; d: string }>
  stickers: Record<string, { label: string; parts: { c: string; d: string }[] }>
}
export const SHAPE_LIBRARY = LIB as Lib
export const SHAPE_TYPES = Object.keys(SHAPE_LIBRARY.shapes)
export const STICKER_TYPES = Object.keys(SHAPE_LIBRARY.stickers)

export function itemKind(it: Dict): ShapeKind | 'text' {
  return (SHAPE_KINDS as readonly unknown[]).includes(it.kind) ? (it.kind as ShapeKind) : 'text'
}

/** Python float(v) clamped; junk → default (py _num). */
export function numPy(v: unknown, lo: number, hi: number, dflt: number): number {
  let f: number
  if (typeof v === 'number') f = v
  else if (typeof v === 'boolean') f = v ? 1 : 0
  else if (typeof v === 'string' && v.trim() !== '') f = Number(v.trim())
  else return dflt
  if (!Number.isFinite(f)) return dflt
  return Math.min(hi, Math.max(lo, f))
}

export const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)

export type ShapeSpec =
  | { kind: 'shape'; type: string; w: number; h: number }
  | { kind: 'sticker'; type: string }
  | { kind: 'progress'; w: number; h: number; track: string | null; trackOpacity: number }

export function shapeSpec(it: Dict): ShapeSpec | null {
  const kind = itemKind(it)
  if (kind === 'shape') {
    const sh = isDict(it.shape) ? it.shape : {}
    const type = sh.type
    if (typeof type !== 'string' || !Object.hasOwn(SHAPE_LIBRARY.shapes, type)) return null
    return { kind, type, w: numPy(sh.w, SHAPE_MIN, SHAPE_MAX, 400), h: numPy(sh.h, SHAPE_MIN, SHAPE_MAX, 400) }
  }
  if (kind === 'sticker') {
    const sid = it.sticker
    if (typeof sid !== 'string' || !Object.hasOwn(SHAPE_LIBRARY.stickers, sid)) return null
    return { kind, type: sid }
  }
  if (kind === 'progress') {
    const p = isDict(it.progress) ? it.progress : {}
    return {
      kind,
      w: numPy(p.w, PROGRESS_W_MIN, PROGRESS_W_MAX, 100),
      h: numPy(p.h, PROGRESS_H_MIN, PROGRESS_H_MAX, 16),
      track: isHex(p.track) ? p.track : null,
      trackOpacity: numPy(p.trackOpacity, 0, 100, 35),
    }
  }
  return null
}

/** Unit-box path (0..1000) → px (py scale_path). */
export function scalePath(d: string, w: number, h: number): string {
  const out: string[] = []
  let axis = 0
  for (const tok of d.split(/\s+/).filter(Boolean)) {
    if (/^[A-Za-z]+$/.test(tok)) {
      out.push(tok)
      axis = 0
      continue
    }
    out.push(String(pyRound((Number(tok) * (axis === 0 ? w : h)) / 1000)))
    axis ^= 1
  }
  return out.join(' ')
}

export const boxPrefix = (w: number, h: number) => `m 0 0 m ${pyRound(w)} ${pyRound(h)} `

export function bgr(hexRgb: unknown): string {
  let h = String(hexRgb ?? '').trim().replace(/^#+/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) h = 'FFFFFF'
  const [r, g, b] = [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)].map((x) => parseInt(x, 16))
  return `&H${hex2(b!)}${hex2(g!)}${hex2(r!)}&`
}

export function shapeSizePx(spec: ShapeSpec, it: Dict, fw: number, fh: number): [number, number] {
  if (spec.kind === 'shape') return [pyRoundN((spec.w * fh) / 1920, 2), pyRoundN((spec.h * fh) / 1920, 2)]
  if (spec.kind === 'sticker') {
    const st = isDict(it.style) ? it.style : {}
    const s = pyRoundN((numPy(st.size, 24, 960, 240) * fh) / 1920, 2)
    return [s, s]
  }
  return [pyRoundN((spec.w * fw) / 100, 2), pyRoundN((spec.h * fh) / 1920, 2)]
}

export function shapeParts(spec: ShapeSpec, w: number, h: number): [string | null, string][] {
  const pre = boxPrefix(w, h)
  if (spec.kind === 'shape') return [[null, pre + scalePath(SHAPE_LIBRARY.shapes[spec.type]!.d, w, h)]]
  if (spec.kind === 'sticker') return SHAPE_LIBRARY.stickers[spec.type]!.parts.map((p) => [p.c, pre + scalePath(p.d, w, h)])
  return []
}

export const progressPath = (w: number, h: number, fillW: number) => `${boxPrefix(w, h)}m 0 0 l ${fillW} 0 ${fillW} ${pyRound(h)} 0 ${pyRound(h)}`

/** Helpers shared with text-items-ass (passed in to avoid an import cycle). */
export type ShapeCtx = {
  alphaForOpacity: (op: unknown) => number
  anchor: (it: Dict, w: number, h: number) => [number, number]
  gradientBands: (g: { from: string; to: string; dir: 'v' | 'h' }, cx: number, cy: number, bw: number, bh: number, w: number, h: number) => string[]
  ts: (cs: number) => string
  gradientOf: (st: Dict) => { from: string; to: string; dir: 'v' | 'h' } | null
}

const IDENT = { x: 0.0, y: 0.0, scale: 100.0, rotation: 0.0, opacity: 100.0 }

/** py text_shapes_ass.shape_item_events. */
export function shapeItemEvents(
  i: number,
  it: Dict & { id: string; startMs: number; endMs: number; style: Dict },
  tracks: Track[],
  ctx: ShapeCtx,
  w: number,
  h: number,
  fps = MOTION_FPS,
  layer = 1,
): string[] {
  const spec = shapeSpec(it)
  if (!spec) return []
  const st = it.style
  const style = `T${i}`
  const [ax, ay] = ctx.anchor(it, w, h)
  const [bw, bh] = shapeSizePx(spec, it, w, h)
  const parts = shapeParts(spec, bw, bh)
  const grad = spec.kind === 'shape' ? ctx.gradientOf(st) : null
  const progress = spec.kind === 'progress'
  const trackA = progress ? ctx.alphaForOpacity(spec.trackOpacity) : 255
  const start = it.startMs
  const end = it.endMs
  const target = `text:${it.id}`
  const motion = hasMotionPy(tracks, target)
  const anim = normLayerAnim(it.anim)
  const shadow = isDict(st.shadow) ? st.shadow : null
  const shadowA = shadow ? ctx.alphaForOpacity(shadow.opacity ?? 100) : 255
  const events: string[] = []
  const ev = (sCs: number, eCs: number, text: string) => events.push(`Dialogue: ${layer},${ctx.ts(sCs)},${ctx.ts(eCs)},${style},,0,0,0,,${text}`)

  const draw = (sCs: number, eCs: number, head: string, cx: number, cy: number, scale: number, op: number, fillW: number | null) => {
    if (spec.kind === 'progress') {
      if (spec.track) {
        const a = pyRound(255 - (255 - trackA) * op)
        ev(sCs, eCs, `{${head}\\1c${bgr(spec.track)}\\1a&H${hex2(a)}&\\p1}${progressPath(bw, bh, pyRound(bw))}`)
      }
      if (fillW === null) {
        const x0 = pyRound(cx - bw / 2)
        const x1 = pyRound(cx + bw / 2)
        const y0 = pyRound(cy - bh / 2) - PROGRESS_CLIP_PAD
        const y1 = pyRound(cy + bh / 2) + PROGRESS_CLIP_PAD
        ev(sCs, eCs, `{${head}\\clip(${x0},${y0},${x0},${y1})\\t(\\clip(${x0},${y0},${x1},${y1}))\\p1}${progressPath(bw, bh, pyRound(bw))}`)
      } else if (fillW > 0) ev(sCs, eCs, `{${head}\\p1}${progressPath(bw, bh, fillW)}`)
      return
    }
    const bands = grad ? ctx.gradientBands(grad, cx, cy, (bw * scale) / 100, (bh * scale) / 100, w, h) : ['']
    for (const [c, d] of parts) {
      const col = c ? `\\1c${bgr(c)}` : ''
      for (const band of bands) ev(sCs, eCs, `{${head}${col}${band}\\p1}${d}`)
    }
  }
  const fillAt = (tMs: number) => {
    let p = (tMs - start) / (end - start)
    p = p < 0 ? 0.0 : p > 1 ? 1.0 : p
    return pyRound(bw * p)
  }
  const staticHead = `\\an5\\pos(${pyRound(ax)},${pyRound(ay)})`
  if (!motion && !anim) {
    draw(Math.floor(start / 10), Math.floor(end / 10), staticHead, ax, ay, 100.0, 1.0, null)
    return events
  }
  const f0 = Math.trunc(Math.ceil((start * fps) / 1000 - 1e-9))
  const f1 = Math.trunc(Math.ceil((end * fps) / 1000 - 1e-9))
  const [dIn, dOut] = anim ? fitDurations(anim, end - start) : [0, 0]
  let spans: [number, number][]
  let mid: [number, number] | null = null
  if (motion || progress || (anim && anim.loop)) spans = [[f0, f1]]
  else {
    const fi = dIn ? Math.trunc(Math.ceil(((start + dIn) * fps) / 1000 - 1e-9)) : f0
    let fo = dOut ? Math.trunc(Math.ceil(((end - dOut) * fps) / 1000 - 1e-9)) : f1
    fo = Math.max(fo, fi)
    spans = [[f0, fi], [fo, f1]]
    const csA = dIn ? Math.trunc(Math.floor((fi * 100) / fps + 1e-9)) : Math.floor(start / 10)
    const csB = dOut ? Math.trunc(Math.floor((fo * 100) / fps + 1e-9)) : Math.floor(end / 10)
    mid = csB > csA ? [csA, csB] : null
  }
  spans.forEach(([fa, fb], si) => {
    if (si === 1 && mid) draw(mid[0], mid[1], staticHead, ax, ay, 100.0, 1.0, null)
    for (let f = fa; f < fb; f++) {
      const tMs = (f * 1000) / fps
      const sCs = Math.trunc(Math.floor((f * 100) / fps + 1e-9))
      const eCs = Math.trunc(Math.floor(((f + 1) * 100) / fps + 1e-9))
      if (eCs <= sCs) continue
      let tf = motion ? layerTransformAtPy(tracks, target, tMs - start) : { ...IDENT }
      if (anim) {
        const fan = frameAnim(anim, tMs, start, end, dIn, dOut)
        tf = { x: tf.x + fan.dx, y: tf.y + fan.dy, scale: tf.scale * fan.sc, rotation: tf.rotation + fan.rot, opacity: tf.opacity * fan.op }
      }
      const op = Math.max(0.0, Math.min(1.0, tf.opacity / 100))
      const aTxt = pyRound(255 * (1 - op))
      const aSh = pyRound(255 - (255 - shadowA) * op)
      const cx = ax + (tf.x * w) / 100
      const cy = ay + (tf.y * h) / 100
      const px = pyRound(cx)
      const py = pyRound(cy)
      const sc = pyFloatStr(pyRoundN(tf.scale, 2))
      const rot = pyFloatStr(pyRoundN(-tf.rotation, 2))
      const head = `\\an5\\pos(${px},${py})\\org(${px},${py})\\fscx${sc}\\fscy${sc}\\frz${rot}\\1a&H${hex2(aTxt)}&\\3a&H${hex2(aTxt)}&\\4a&H${hex2(aSh)}&`
      draw(sCs, eCs, head, cx, cy, tf.scale, op, progress ? fillAt(tMs) : null)
    }
  })
  return events
}
