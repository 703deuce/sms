/**
 * G3a: TS port of worker/clips_worker/text_anim.py — text animations (in / out / loop) for text
 * items. Same float operations in the same order (only + - * /), so the ASS is byte-identical to
 * the worker and the editor preview (libass-wasm) shows exactly what export burns.
 */
import { pyRound } from '@/lib/clips/render-plan/py'

export const TEXT_ANIM_IN_TYPES = ['fade', 'pop', 'zoom', 'slide_up', 'slide_down', 'slide_left', 'slide_right', 'typewriter', 'bounce_in', 'zoom_out', 'rotate_in'] as const
export const TEXT_ANIM_BLOCK_ONLY = ['zoom', 'slide_up', 'slide_down', 'slide_left', 'slide_right', 'bounce_in', 'zoom_out', 'rotate_in'] as const
/** EFFECTS1: text-only types (layers fall back to fade, same as py TEXT_ONLY). */
export const TEXT_ONLY_ANIM: ReadonlySet<string> = new Set(['typewriter', 'bounce_in', 'zoom_out', 'rotate_in'])
export const TEXT_ANIM_UNITS = ['block', 'line', 'word', 'char'] as const
export const TEXT_ANIM_LOOP_TYPES = ['pulse', 'bounce', 'wiggle', 'flicker'] as const
export type TextAnimType = (typeof TEXT_ANIM_IN_TYPES)[number]
export type TextAnimUnit = (typeof TEXT_ANIM_UNITS)[number]
export type TextAnimLoopType = (typeof TEXT_ANIM_LOOP_TYPES)[number]
export type TextAnimEdge = { type: TextAnimType; unit: TextAnimUnit; durMs: number }
export type TextAnim = { in?: TextAnimEdge; out?: TextAnimEdge; loop?: { type: TextAnimLoopType; periodMs: number } }

export const DUR_MIN = 100
export const DUR_MAX = 5000
export const DUR_DEFAULT = 500
export const PERIOD_MIN = 300
export const PERIOD_MAX = 4000
export const PERIOD_DEFAULT = 1000
const SLIDE_Y_PCT = 8.0
const SLIDE_X_PCT = 10.0

type Dict = Record<string, unknown>
const isDict = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v)
const inList = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v)

function intMs(v: unknown, lo: number, hi: number, dflt: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return dflt
  return Math.max(lo, Math.min(hi, pyRound(v)))
}

/** Builder-side normalisation (py norm_anim). */
export function normAnim(raw: unknown): TextAnim | null {
  if (!isDict(raw)) return null
  const out: TextAnim = {}
  for (const edge of ['in', 'out'] as const) {
    const a = raw[edge]
    if (!isDict(a) || !inList(TEXT_ANIM_IN_TYPES, a.type)) continue
    const type = a.type
    let unit: TextAnimUnit = inList(TEXT_ANIM_UNITS, a.unit) ? a.unit : 'block'
    if (inList(TEXT_ANIM_BLOCK_ONLY, type)) unit = 'block'
    if (type === 'typewriter' && unit === 'block') unit = 'char'
    out[edge] = { type, unit, durMs: intMs(a.durMs, DUR_MIN, DUR_MAX, DUR_DEFAULT) }
  }
  const lp = raw.loop
  if (isDict(lp) && inList(TEXT_ANIM_LOOP_TYPES, lp.type)) {
    out.loop = { type: lp.type, periodMs: intMs(lp.periodMs, PERIOD_MIN, PERIOD_MAX, PERIOD_DEFAULT) }
  }
  return Object.keys(out).length ? out : null
}

/** G3b: layers (B-roll / images / shapes / stickers / progress bars) take the block presets only. */
export const LAYER_ANIM_TYPES = TEXT_ANIM_IN_TYPES.filter((t) => !TEXT_ONLY_ANIM.has(t))

/** G3b: in / out / loop for a non-text layer — whole-layer presets, typewriter → fade (py norm_layer_anim). */
export function normLayerAnim(raw: unknown): TextAnim | null {
  const a = normAnim(raw)
  if (!a) return null
  const out: TextAnim = {}
  for (const edge of ['in', 'out'] as const) {
    const e = a[edge]
    if (e) out[edge] = { type: TEXT_ONLY_ANIM.has(e.type) ? 'fade' : e.type, unit: 'block', durMs: e.durMs }
  }
  if (a.loop) out.loop = a.loop
  return Object.keys(out).length ? out : null
}

export function fitDurations(anim: TextAnim, lengthMs: number): [number, number] {
  const di = anim.in ? anim.in.durMs : 0
  const dOut = anim.out ? anim.out.durMs : 0
  if (di + dOut > lengthMs && di + dOut > 0) {
    const di2 = Math.floor((lengthMs * di) / (di + dOut))
    return [di2, dOut ? lengthMs - di2 : 0]
  }
  return [di, dOut]
}

export const easeOut = (p: number): number => {
  const q = 1.0 - p
  return 1.0 - q * q * q
}
export const easeBack = (p: number): number => {
  const q = p - 1.0
  return 1.0 + 2.70158 * q * q * q + 1.70158 * q * q
}
const clamp01 = (v: number) => (v < 0.0 ? 0.0 : v > 1.0 ? 1.0 : v)

type Block = { op: number; sc: number; dx: number; dy: number; rot?: number }
/**
 * G3afix: an OUT slide is named by the direction it LEAVES in ("Slide down" exits downward), so it
 * replays the mirrored in-curve (block_state of the opposite slide) — text_anim.OUT_MOTION.
 */
export const OUT_MOTION: Record<string, string> = { slide_up: 'slide_down', slide_down: 'slide_up', slide_left: 'slide_right', slide_right: 'slide_left' }

export function blockState(type: string, p0: number): Block {
  const p = clamp01(p0)
  const e = easeOut(p)
  switch (type) {
    case 'fade':
      return { op: e, sc: 1.0, dx: 0.0, dy: 0.0 }
    case 'pop':
      return { op: clamp01(p * 3.0), sc: 0.3 + 0.7 * easeBack(p), dx: 0.0, dy: 0.0 }
    case 'zoom':
      return { op: e, sc: 0.4 + 0.6 * e, dx: 0.0, dy: 0.0 }
    case 'slide_up':
      return { op: e, sc: 1.0, dx: 0.0, dy: (1.0 - e) * SLIDE_Y_PCT }
    case 'slide_down':
      return { op: e, sc: 1.0, dx: 0.0, dy: -(1.0 - e) * SLIDE_Y_PCT }
    case 'slide_left':
      return { op: e, sc: 1.0, dx: (1.0 - e) * SLIDE_X_PCT, dy: 0.0 }
    case 'slide_right':
      return { op: e, sc: 1.0, dx: -(1.0 - e) * SLIDE_X_PCT, dy: 0.0 }
    case 'bounce_in':
      return { op: clamp01(p * 3.0), sc: 1.0, dx: 0.0, dy: (easeBack(p) - 1.0) * 12.0 }
    case 'zoom_out':
      return { op: e, sc: 1.6 - 0.6 * e, dx: 0.0, dy: 0.0 }
    case 'rotate_in':
      return { op: e, sc: 0.6 + 0.4 * e, dx: 0.0, dy: 0.0, rot: (1.0 - e) * -90.0 }
    default:
      return { op: 1.0, sc: 1.0, dx: 0.0, dy: 0.0 }
  }
}

export function unitState(type: string, k: number, n: number, t: number, d: number): [number, number] {
  if (type === 'typewriter') return [t * n >= k * d ? 1.0 : 0.0, 1.0]
  let ln: number
  let s: number
  if (n <= 1) {
    ln = d
    s = 0.0
  } else {
    ln = (d * 2) / (n + 1)
    s = (d - ln) / (n - 1)
  }
  const p = ln > 0 ? clamp01((t - k * s) / ln) : 1.0
  if (type === 'pop') return [clamp01(p * 3.0), 0.3 + 0.7 * easeBack(p)]
  return [easeOut(p), 1.0]
}

export function loopState(type: string, t: number, period: number): { op: number; sc: number; dy: number; rot: number } {
  const ph = (t % period) / period
  const tri = 1.0 - Math.abs(2.0 * ph - 1.0)
  const sm = tri * tri * (3.0 - 2.0 * tri)
  if (type === 'pulse') return { op: 1.0, sc: 1.0 + 0.08 * sm, dy: 0.0, rot: 0.0 }
  if (type === 'bounce') return { op: 1.0, sc: 1.0, dy: -2.0 * sm, rot: 0.0 }
  if (type === 'wiggle') return { op: 1.0, sc: 1.0, dy: 0.0, rot: 6.0 * (2.0 * sm - 1.0) }
  if (type === 'flicker') return { op: 1.0 - 0.6 * sm, sc: 1.0, dy: 0.0, rot: 0.0 }
  return { op: 1.0, sc: 1.0, dy: 0.0, rot: 0.0 }
}

/** Display text → [piece, isUnit][] (py split_units; iterates code points like Python). */
export function splitUnits(text: string, unit: string): [string, boolean][] {
  const out: [string, boolean][] = []
  if (unit === 'line') {
    text.split('\n').forEach((ln, i) => {
      if (i) out.push(['\n', false])
      if (ln) out.push([ln, true])
    })
    return out
  }
  let cur = ''
  for (const ch of Array.from(text)) {
    if (ch === ' ' || ch === '\n') {
      if (cur) {
        out.push([cur, true])
        cur = ''
      }
      out.push([ch, false])
    } else if (unit === 'char') out.push([ch, true])
    else cur += ch
  }
  if (cur) out.push([cur, true])
  return out
}

export type UnitAnim = { type: string; unit: string; t: number; d: number; rev: boolean }
export type FrameAnim = { op: number; sc: number; dx: number; dy: number; rot: number; unit: UnitAnim | null }

export function frameAnim(anim: TextAnim, tMs: number, start: number, end: number, dIn: number, dOut: number): FrameAnim {
  let op = 1.0
  let sc = 1.0
  let dx = 0.0
  let dy = 0.0
  let rot = 0.0
  let unit: UnitAnim | null = null
  const tl = tMs - start
  const tr = end - tMs
  const aIn = anim.in
  if (aIn && dIn > 0 && tl < dIn) {
    if (aIn.unit === 'block') {
      const b = blockState(aIn.type, tl / dIn)
      op = op * b.op
      sc = sc * b.sc
      dx = dx + b.dx
      dy = dy + b.dy
      rot = rot + (b.rot ?? 0.0)
    } else unit = { type: aIn.type, unit: aIn.unit, t: tl, d: dIn, rev: false }
  }
  const aOut = anim.out
  if (aOut && dOut > 0 && tr < dOut) {
    if (aOut.unit === 'block') {
      const b = blockState(OUT_MOTION[aOut.type] ?? aOut.type, tr / dOut)
      op = op * b.op
      sc = sc * b.sc
      dx = dx + b.dx
      dy = dy + b.dy
      rot = rot + (b.rot ?? 0.0)
    } else if (unit === null) unit = { type: aOut.type, unit: aOut.unit, t: tr, d: dOut, rev: true }
  }
  const lp = anim.loop
  if (lp) {
    const s = loopState(lp.type, tl, lp.periodMs)
    op = op * s.op
    sc = sc * s.sc
    dy = dy + s.dy
    rot = rot + s.rot
  }
  return { op, sc, dx, dy, rot, unit }
}
