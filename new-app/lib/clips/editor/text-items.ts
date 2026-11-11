/**
 * E4 Text layers: free text items on the Text lane (CapCut "Text" → "Add text"). Additive JSON
 * `edits.textItems` — independent of layers v3 (whose legacy sync is lossy, see E0 §E6), so editing
 * text never rewrites headline / badge state.
 *
 * Geometry is resolution independent: (x, y) is the anchor in % of the frame (0..100); sizes are px at a
 * 1920 px tall frame (the caption-presets-v2 `sizePx1920` convention). Export: clips_worker/text_items.py
 * writes ASS (PlayRes = output size, fontsize = size·H/1920) and burns it in the hook stage. Preview:
 * components/clips/editor/text-items-preview.tsx with CSS px = ASS px · cssEmPerAssFontsize · boxH/H.
 * Time: startMs / endMs are OUTPUT (edit) ms like B-roll; keyframe target `text:<id>` is item-local.
 *
 * No React imports, so lib/clips/edits.ts can use it.
 */
import { normAnim, normLayerAnim, type TextAnim } from '@/lib/clips/render-plan/text-anim'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { CATALOG_TEMPLATES } from '@/lib/clips/editor/text-templates-catalog'
import { normMarks, safeFamily, userFontId, type TextMark } from '@/lib/clips/render-plan/text-rich'
import {
  PROGRESS_H_MAX,
  PROGRESS_H_MIN,
  PROGRESS_W_MAX,
  PROGRESS_W_MIN,
  SHAPE_LIBRARY,
  SHAPE_MAX,
  SHAPE_MIN,
  type ShapeKind,
} from '@/lib/clips/render-plan/text-shapes'

export type { TextMark } from '@/lib/clips/render-plan/text-rich'

export type TextAlign = 'left' | 'center' | 'right'
export type TextCase = 'none' | 'upper'

export type TextStroke = { color: string; width: number }
export type TextShadow = { color: string; opacity: number; dist: number }
export type TextBox = { color: string; opacity: number; pad: number }
/** G3b: two-colour gradient fill (top → bottom 'v' or left → right 'h'). */
export type TextGradient = { from: string; to: string; dir: 'v' | 'h' }

export type TextStyle = {
  font: TextFontId
  /** Font size in px at a 1920 px tall frame (ASS fontsize = size · H / 1920). */
  size: number
  color: string
  align: TextAlign
  case: TextCase
  stroke?: TextStroke
  shadow?: TextShadow
  box?: TextBox
  /** G3b: a workspace font (`font: 'user:<id>'`) — its family name, as the ASS Fontname. */
  fontFamily?: string
  /** G3b: extra px between letters at a 1920 px tall frame (−20…100; absent = 0). */
  letterSpacing?: number
  /** G3b: line height multiplier (0.7…2.5; absent = 1 = the font's own). */
  lineHeight?: number
  gradient?: TextGradient
}

export type ShapeGeom = { type: string; w: number; h: number }
export type ProgressGeom = { w: number; h: number; track?: string; trackOpacity: number }

export type TextItem = {
  id: string
  text: string
  startMs: number
  endMs: number
  /** Anchor in % of the frame; the anchor is the left / centre / right of the text's middle line. */
  x: number
  y: number
  style: TextStyle
  presetId?: string
  /** G3a: in / out / loop animation (render-plan/text-anim.ts == worker text_anim.py). */
  anim?: TextAnim
  /** G3b: bold / italic ranges in code points of `text`. */
  marks?: TextMark[]
  /** G3b: a shape / sticker / progress bar instead of text (render-plan/text-shapes.ts). */
  kind?: ShapeKind
  shape?: ShapeGeom
  sticker?: string
  progress?: ProgressGeom
}

/**
 * Fonts that are single-weight files in BOTH the worker image (fontconfig; worker/Dockerfile) and the
 * editor (next/font). `ass` is the fontconfig family, `weight` the CSS weight of the shipped face.
 */
export const TEXT_FONTS = [
  { id: 'Montserrat', label: 'Montserrat Black', ass: 'Montserrat', weight: 900 },
  { id: 'Anton', label: 'Anton', ass: 'Anton', weight: 400 },
  { id: 'Poppins', label: 'Poppins ExtraBold', ass: 'Poppins', weight: 800 },
  { id: 'Bangers', label: 'Bangers', ass: 'Bangers', weight: 400 },
  { id: 'Bebas Neue', label: 'Bebas Neue', ass: 'Bebas Neue', weight: 400 },
  { id: 'Archivo Black', label: 'Archivo Black', ass: 'Archivo Black', weight: 400 },
  { id: 'Luckiest Guy', label: 'Luckiest Guy', ass: 'Luckiest Guy', weight: 400 },
  { id: 'Rubik', label: 'Rubik', ass: 'Rubik', weight: 400 },
  { id: 'Gabarito', label: 'Gabarito', ass: 'Gabarito', weight: 400 },
  { id: 'Fira Sans Condensed', label: 'Fira Sans Condensed', ass: 'Fira Sans Condensed', weight: 700 },
  { id: 'DM Serif Display', label: 'DM Serif Display', ass: 'DM Serif Display', weight: 400 },
  { id: 'Playfair Display', label: 'Playfair Display', ass: 'Playfair Display', weight: 400 },
  { id: 'Caveat', label: 'Caveat', ass: 'Caveat', weight: 400 },
  { id: 'Space Grotesk', label: 'Space Grotesk', ass: 'Space Grotesk', weight: 400 },
  { id: 'Inter', label: 'Inter', ass: 'Inter', weight: 400 },
  { id: 'Lato', label: 'Lato Black', ass: 'Lato Black', weight: 900 },
  { id: 'Oswald', label: 'Oswald', ass: 'Oswald', weight: 400 },
  { id: 'Space Mono', label: 'Space Mono', ass: 'Space Mono', weight: 400 },
] as const
export type BuiltinFontId = (typeof TEXT_FONTS)[number]['id']
/** G3b: `user:<id>` = an uploaded workspace font (clip_fonts). */
export type TextFontId = BuiltinFontId | `user:${string}`
const FONT_IDS = TEXT_FONTS.map((f) => f.id) as readonly string[]

export const TEXT_SIZE_MIN = 24
export const TEXT_SIZE_MAX = 240
export const TEXT_MIN_MS = 300
export const TEXT_DEFAULT_MS = 3000
export const TEXT_MAX_CHARS = 200
export const TEXT_MAX_ITEMS = 60
/** G3b: stickers are sized by style.size (px@1920) up to half the frame height. */
export const STICKER_SIZE_MAX = 960
export const LETTER_SPACING_MIN = -20
export const LETTER_SPACING_MAX = 100
export const LINE_HEIGHT_MIN = 0.7
export const LINE_HEIGHT_MAX = 2.5

export const DEFAULT_TEXT_STYLE: TextStyle = {
  font: 'Montserrat',
  size: 96,
  color: '#FFFFFF',
  align: 'center',
  case: 'none',
  stroke: { color: '#000000', width: 6 },
}

/**
 * Text presets. The first four ARE the existing headline title styles (lib/clips/templates/title-styles.json,
 * Anton upper) so the look matches the T6 title; the rest are CapCut-style basics using the caption fonts.
 */
export const TEXT_PRESETS: { id: string; label: string; style: TextStyle }[] = [
  { id: 'title_white_on_black', label: 'Title · black box', style: { font: 'Anton', size: 92, color: '#FFFFFF', align: 'center', case: 'upper', box: { color: '#000000', opacity: 100, pad: 18 } } },
  { id: 'title_white_on_dark_blur', label: 'Title · dark', style: { font: 'Anton', size: 92, color: '#FFFFFF', align: 'center', case: 'upper', box: { color: '#000000', opacity: 55, pad: 18 } } },
  { id: 'title_black_on_light_blur', label: 'Title · light', style: { font: 'Anton', size: 92, color: '#111111', align: 'center', case: 'upper', box: { color: '#FFFFFF', opacity: 70, pad: 18 } } },
  { id: 'title_white_box_black', label: 'Title · white box', style: { font: 'Anton', size: 92, color: '#000000', align: 'center', case: 'upper', box: { color: '#FFFFFF', opacity: 100, pad: 18 } } },
  { id: 'basic', label: 'Basic', style: DEFAULT_TEXT_STYLE },
  { id: 'outline_yellow', label: 'Punch yellow', style: { font: 'Montserrat', size: 104, color: '#FACC15', align: 'center', case: 'upper', stroke: { color: '#000000', width: 8 } } },
  { id: 'shadow_soft', label: 'Soft shadow', style: { font: 'Poppins', size: 84, color: '#FFFFFF', align: 'center', case: 'none', shadow: { color: '#000000', opacity: 70, dist: 6 } } },
  { id: 'comic', label: 'Comic', style: { font: 'Bangers', size: 120, color: '#FFFFFF', align: 'center', case: 'upper', stroke: { color: '#000000', width: 10 }, shadow: { color: '#000000', opacity: 100, dist: 6 } } },
  { id: 'label_red', label: 'Red label', style: { font: 'Archivo Black', size: 72, color: '#FFFFFF', align: 'center', case: 'upper', box: { color: '#E11D48', opacity: 100, pad: 16 } } },
  { id: 'tall_clean', label: 'Tall clean', style: { font: 'Bebas Neue', size: 130, color: '#FFFFFF', align: 'center', case: 'upper', shadow: { color: '#000000', opacity: 60, dist: 4 } } },
  { id: 'hype', label: 'Hype', style: { font: 'Luckiest Guy', size: 110, color: '#22D3EE', align: 'center', case: 'upper', stroke: { color: '#0F172A', width: 8 } } },
  { id: 'caption_left', label: 'Lower third', style: { font: 'Poppins', size: 64, color: '#FFFFFF', align: 'left', case: 'none', box: { color: '#0F172A', opacity: 80, pad: 14 } } },
  { id: 'wa_sunset', label: 'WordArt · Sunset', style: { font: 'Luckiest Guy', size: 120, color: '#FDE047', align: 'center', case: 'upper', stroke: { color: '#7C2D12', width: 8 }, gradient: { from: '#FDE047', to: '#F97316', dir: 'v' } } },
  { id: 'wa_neon', label: 'WordArt · Neon', style: { font: 'Bebas Neue', size: 130, color: '#F0ABFC', align: 'center', case: 'upper', stroke: { color: '#701A75', width: 6 }, shadow: { color: '#E879F9', opacity: 80, dist: 1 } } },
  { id: 'wa_chrome', label: 'WordArt · Chrome', style: { font: 'Anton', size: 128, color: '#F8FAFC', align: 'center', case: 'upper', stroke: { color: '#0F172A', width: 6 }, gradient: { from: '#F8FAFC', to: '#64748B', dir: 'v' } } },
  { id: 'wa_retro', label: 'WordArt · Retro', style: { font: 'Bangers', size: 120, color: '#22D3EE', align: 'center', case: 'upper', shadow: { color: '#1E1B4B', opacity: 100, dist: 8 }, gradient: { from: '#22D3EE', to: '#F472B6', dir: 'h' } } },
  { id: 'wa_fire', label: 'WordArt · Fire', style: { font: 'Archivo Black', size: 110, color: '#FACC15', align: 'center', case: 'upper', stroke: { color: '#000000', width: 8 }, gradient: { from: '#FACC15', to: '#DC2626', dir: 'v' } } },
  { id: 'wa_ice', label: 'WordArt · Ice', style: { font: 'Montserrat', size: 104, color: '#FFFFFF', align: 'center', case: 'upper', stroke: { color: '#0C4A6E', width: 6 }, gradient: { from: '#FFFFFF', to: '#38BDF8', dir: 'v' } } },
]

export function textPreset(id: string | undefined): { id: string; label: string; style: TextStyle } | undefined {
  return TEXT_PRESETS.find((p) => p.id === id)
}

const HEX = /^#[0-9a-fA-F]{6}$/
function hex(v: unknown, fallback: string): string {
  return typeof v === 'string' && HEX.test(v) ? v.toUpperCase() : fallback
}
function num(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback
}

export function normalizeTextStyle(raw: unknown, maxSize: number = TEXT_SIZE_MAX): TextStyle {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const d = DEFAULT_TEXT_STYLE
  // G3b: a workspace font needs its family name (the ASS Fontname); without one it falls back.
  const fam = safeFamily(o.fontFamily)
  const userFont = userFontId(o.font) && fam ? (o.font as TextFontId) : null
  const style: TextStyle = {
    font: userFont ?? ((typeof o.font === 'string' && FONT_IDS.includes(o.font) ? o.font : d.font) as TextFontId),
    size: Math.round(num(o.size, TEXT_SIZE_MIN, maxSize, d.size)),
    color: hex(o.color, d.color),
    align: o.align === 'left' || o.align === 'right' ? o.align : 'center',
    case: o.case === 'upper' ? 'upper' : 'none',
  }
  const st = o.stroke as Record<string, unknown> | undefined
  if (st && typeof st === 'object' && Number(st.width) > 0)
    style.stroke = { color: hex(st.color, '#000000'), width: Math.round(num(st.width, 0, 24, 6)) }
  const sh = o.shadow as Record<string, unknown> | undefined
  if (sh && typeof sh === 'object' && Number(sh.dist) > 0 && Number(sh.opacity ?? 100) > 0)
    style.shadow = { color: hex(sh.color, '#000000'), opacity: Math.round(num(sh.opacity, 0, 100, 70)), dist: Math.round(num(sh.dist, 0, 24, 6)) }
  const bx = o.box as Record<string, unknown> | undefined
  if (bx && typeof bx === 'object' && Number(bx.opacity ?? 100) > 0)
    style.box = { color: hex(bx.color, '#000000'), opacity: Math.round(num(bx.opacity, 0, 100, 100)), pad: Math.round(num(bx.pad, 0, 80, 16)) }
  if (userFont) style.fontFamily = fam
  const ls = Math.round(num(o.letterSpacing, LETTER_SPACING_MIN, LETTER_SPACING_MAX, 0))
  if (ls) style.letterSpacing = ls
  const lh = Math.round(num(o.lineHeight, LINE_HEIGHT_MIN, LINE_HEIGHT_MAX, 1) * 100) / 100
  if (lh !== 1) style.lineHeight = lh
  const g = o.gradient as Record<string, unknown> | undefined
  if (g && typeof g === 'object' && HEX.test(String(g.from)) && HEX.test(String(g.to)))
    style.gradient = { from: hex(g.from, '#FFFFFF'), to: hex(g.to, '#FFFFFF'), dir: g.dir === 'h' ? 'h' : 'v' }
  return style
}

/** Text items within [0, clipEndMs], ≥ TEXT_MIN_MS long, integer ms, ≤ TEXT_MAX_ITEMS. */
export function normalizeTextItems(raw: unknown, clipEndMs?: number): TextItem[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const end = Number.isFinite(clipEndMs) ? Math.max(0, Math.floor(clipEndMs as number)) : Infinity
  const out: TextItem[] = []
  const seen = new Set<string>()
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const id = String(o.id ?? '').slice(0, 64)
    const kind = o.kind === 'shape' || o.kind === 'sticker' || o.kind === 'progress' ? o.kind : undefined
    const text = kind ? '' : Array.from(String(o.text ?? '').replace(/\r/g, '')).slice(0, TEXT_MAX_CHARS).join('')
    if (!id || seen.has(id) || !/^[A-Za-z0-9_~-]+$/.test(id) || (!kind && !text.trim())) continue
    const geom = kind ? normalizeShapeGeom(kind, o) : null
    if (kind && !geom) continue
    let a = Math.round(Number(o.startMs))
    let b = Math.round(Number(o.endMs))
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue
    a = Math.max(0, a)
    if (end !== Infinity) a = Math.min(a, Math.max(0, end - TEXT_MIN_MS))
    b = Math.max(a + TEXT_MIN_MS, Math.min(b, end === Infinity ? b : end))
    seen.add(id)
    const item: TextItem = {
      id,
      text,
      startMs: a,
      endMs: b,
      x: Math.round(num(o.x, 0, 100, 50) * 10) / 10,
      y: Math.round(num(o.y, 0, 100, 50) * 10) / 10,
      style: normalizeTextStyle(o.style, kind === 'sticker' ? STICKER_SIZE_MAX : TEXT_SIZE_MAX),
    }
    if (typeof o.presetId === 'string' && o.presetId.length <= 64) item.presetId = o.presetId
    if (kind && geom) Object.assign(item, { kind }, geom)
    // G3b: shapes / stickers / progress take whole-layer presets only (worker norm_layer_anim).
    const anim = kind ? normLayerAnim(o.anim) : normAnim(o.anim)
    if (anim) item.anim = anim
    if (!kind) {
      const marks = canonicalMarks(normMarks(o.marks, Array.from(text).length), Array.from(text).length)
      if (marks.length) item.marks = marks
    }
    out.push(item)
    if (out.length >= TEXT_MAX_ITEMS) break
  }
  return out.length ? out.sort((p, q) => p.startMs - q.startMs) : undefined
}

function normalizeShapeGeom(kind: ShapeKind, o: Record<string, unknown>): Pick<TextItem, 'shape' | 'sticker' | 'progress'> | null {
  if (kind === 'shape') {
    const sh = (o.shape && typeof o.shape === 'object' ? o.shape : {}) as Record<string, unknown>
    if (typeof sh.type !== 'string' || !Object.hasOwn(SHAPE_LIBRARY.shapes, sh.type)) return null
    return { shape: { type: sh.type, w: Math.round(num(sh.w, SHAPE_MIN, SHAPE_MAX, 400)), h: Math.round(num(sh.h, SHAPE_MIN, SHAPE_MAX, 400)) } }
  }
  if (kind === 'sticker') {
    return typeof o.sticker === 'string' && Object.hasOwn(SHAPE_LIBRARY.stickers, o.sticker) ? { sticker: o.sticker } : null
  }
  const p = (o.progress && typeof o.progress === 'object' ? o.progress : {}) as Record<string, unknown>
  const progress: ProgressGeom = {
    w: Math.round(num(p.w, PROGRESS_W_MIN, PROGRESS_W_MAX, 100) * 10) / 10,
    h: Math.round(num(p.h, PROGRESS_H_MIN, PROGRESS_H_MAX, 16)),
    trackOpacity: Math.round(num(p.trackOpacity, 0, 100, 35)),
  }
  if (typeof p.track === 'string' && HEX.test(p.track)) progress.track = p.track.toUpperCase()
  return { progress }
}

/** Per-code-point mark bits (1 bold, 2 italic) → the fewest ranges (canonical stored form). */
export function marksToFlags(marks: TextMark[] | undefined, n: number): number[] {
  const flags = new Array<number>(n).fill(0)
  for (const m of marks ?? []) for (let k = Math.max(0, m.s); k < Math.min(n, m.e); k++) flags[k]! |= (m.b ? 1 : 0) | (m.i ? 2 : 0)
  return flags
}

export function flagsToMarks(flags: number[]): TextMark[] {
  const out: TextMark[] = []
  let k = 0
  while (k < flags.length) {
    const f = flags[k]!
    let e = k + 1
    while (e < flags.length && flags[e] === f) e++
    if (f) out.push({ s: k, e, ...(f & 1 ? { b: true as const } : {}), ...(f & 2 ? { i: true as const } : {}) })
    k = e
  }
  return out.slice(0, 50)
}

function canonicalMarks(marks: TextMark[], n: number): TextMark[] {
  return flagsToMarks(marksToFlags(marks, n))
}

/**
 * Toggle bold / italic on code points [s, e) (a textarea selection; empty = the whole text): on when
 * any char in the range lacks it, else off.
 */
export function toggleMark(item: Pick<TextItem, 'text' | 'marks'>, bit: 1 | 2, s0: number, e0: number): TextMark[] | undefined {
  const n = Array.from(item.text).length
  let [s, e] = [Math.max(0, Math.min(s0, e0)), Math.min(n, Math.max(s0, e0))]
  if (e <= s) [s, e] = [0, n]
  const flags = marksToFlags(item.marks, n)
  const on = flags.slice(s, e).some((f) => !(f & bit))
  for (let k = s; k < e; k++) flags[k] = on ? flags[k]! | bit : flags[k]! & ~bit
  const out = flagsToMarks(flags)
  return out.length ? out : undefined
}

/** UTF-16 offset (textarea selection) → code-point index. */
export function cpIndex(text: string, utf16: number): number {
  return Array.from(text.slice(0, Math.max(0, utf16))).length
}

/**
 * Text edited → marks follow it: the common prefix keeps its marks, the common suffix keeps its
 * marks (shifted), the replaced middle takes the style of the char before it.
 */
export function remapMarks(oldText: string, newText: string, marks: TextMark[] | undefined): TextMark[] | undefined {
  if (!marks?.length) return undefined
  const a = Array.from(oldText)
  const b = Array.from(newText)
  const fa = marksToFlags(marks, a.length)
  let p = 0
  while (p < a.length && p < b.length && a[p] === b[p]) p++
  let q = 0
  while (q < a.length - p && q < b.length - p && a[a.length - 1 - q] === b[b.length - 1 - q]) q++
  const fill = p > 0 ? fa[p - 1]! : 0
  const fb = [...fa.slice(0, p), ...new Array<number>(b.length - p - q).fill(fill), ...fa.slice(a.length - q)]
  const out = flagsToMarks(fb)
  return out.length ? out : undefined
}

export function textDisplay(item: Pick<TextItem, 'text' | 'style'>): string {
  return item.style.case === 'upper' ? item.text.toUpperCase() : item.text
}

export function textFont(id: string) {
  return TEXT_FONTS.find((f) => f.id === id) ?? TEXT_FONTS[0]
}

/** New item at the playhead (CapCut "Add text"): centred, default length, clamped to the clip. */
export function newTextItem(id: string, playheadMs: number, clipEndMs: number, presetId = 'basic', text = 'Your text'): TextItem {
  const p = textPreset(presetId) ?? TEXT_PRESETS[4]
  const end = Math.max(TEXT_MIN_MS, Math.floor(clipEndMs))
  const a = Math.max(0, Math.min(Math.round(playheadMs), end - TEXT_MIN_MS))
  return {
    id,
    text,
    startMs: a,
    endMs: Math.min(end, a + TEXT_DEFAULT_MS),
    x: p.style.align === 'left' ? 8 : 50,
    y: p.id === 'caption_left' ? 78 : 40,
    style: { ...p.style },
    presetId: p.id,
  }
}

export function textItemsActiveAt(items: TextItem[] | undefined, ms: number): TextItem[] {
  return (items ?? []).filter((t) => ms >= t.startMs && ms < t.endMs)
}

/** `text:<id>` keyframe target helpers (item-local time like B-roll). */
export function textIdOfTarget(target: string): string | null {
  return target.startsWith('text:') && target.length > 5 ? target.slice(5) : null
}

/** ASS px at PlayResY = h for a value in px@1920 (worker text_items._px / fontsize). */
export function textAssPx(v: number, h: number): number {
  return Math.round(((v * h) / 1920) * 100) / 100
}

/** G3b: base style for shapes / stickers / progress (no stroke). */
const PLAIN_STYLE: TextStyle = { font: 'Montserrat', size: 96, color: '#FFFFFF', align: 'center', case: 'none' }

/** G3b: timeline / layer label for any text-lane item. */
export function textItemLabel(t: Pick<TextItem, 'text' | 'kind' | 'shape' | 'sticker'>): string {
  if (t.kind === 'shape') return `Shape · ${SHAPE_LIBRARY.shapes[t.shape?.type ?? '']?.label ?? 'Shape'}`
  if (t.kind === 'sticker') return `Sticker · ${SHAPE_LIBRARY.stickers[t.sticker ?? '']?.label ?? 'Sticker'}`
  if (t.kind === 'progress') return 'Progress bar'
  return t.text.split('\n')[0]!.trim() || 'Text'
}

function itemWindow(playheadMs: number, clipEndMs: number, lenMs = TEXT_DEFAULT_MS): [number, number] {
  const end = Math.max(TEXT_MIN_MS, Math.floor(clipEndMs))
  const a = Math.max(0, Math.min(Math.round(playheadMs), end - TEXT_MIN_MS))
  return [a, Math.min(end, a + lenMs)]
}

/** Offset % position when stacking overlays at the same spot (+24px steps at 1920 reference). */
export function offsetNewOverlayPosition(edits: ClipEditsV2, x: number, y: number): [number, number] {
  const step = (24 / 1920) * 100
  const items = edits.textItems ?? []
  let n = 0
  for (const it of items) {
    if (Math.abs(it.x - x) < 0.05 && Math.abs(it.y - y) < 0.05) n++
  }
  return [x + n * step, y + n * step]
}

/** G3b: a library shape at the playhead (centred, 400 × 400 px@1920 unless the shape wants a bar). */
export function newShapeItem(id: string, type: string, playheadMs: number, clipEndMs: number): TextItem {
  const [a, b] = itemWindow(playheadMs, clipEndMs)
  const wide = type === 'rect' || type === 'rounded' || type === 'arrow'
  return {
    id,
    text: '',
    kind: 'shape',
    shape: { type, w: wide ? 640 : 400, h: wide ? 220 : 400 },
    startMs: a,
    endMs: b,
    x: 50,
    y: 50,
    style: { ...PLAIN_STYLE, color: '#FACC15' },
    anim: { in: { type: 'pop', unit: 'block', durMs: 400 }, out: { type: 'fade', unit: 'block', durMs: 300 } },
  }
}

export function newStickerItem(id: string, sticker: string, playheadMs: number, clipEndMs: number): TextItem {
  const [a, b] = itemWindow(playheadMs, clipEndMs)
  return {
    id,
    text: '',
    kind: 'sticker',
    sticker,
    startMs: a,
    endMs: b,
    x: 50,
    y: 50,
    style: { ...PLAIN_STYLE, size: 240 },
    anim: { in: { type: 'pop', unit: 'block', durMs: 400 }, out: { type: 'fade', unit: 'block', durMs: 300 } },
  }
}

/** G3b: progress bar — fills left → right over its own length; default = the whole clip at the bottom. */
export function newProgressItem(id: string, clipEndMs: number): TextItem {
  const end = Math.max(TEXT_MIN_MS, Math.floor(clipEndMs))
  return {
    id,
    text: '',
    kind: 'progress',
    progress: { w: 100, h: 16, track: '#FFFFFF', trackOpacity: 35 },
    startMs: 0,
    endMs: end,
    x: 50,
    y: 99.5,
    style: { ...PLAIN_STYLE, color: '#FACC15' },
  }
}

/**
 * G3b: animated title templates — one click adds 1–3 ready-made items (text + shapes) with in / out
 * / loop presets. Everything stays a plain editable item afterwards.
 */
export type TemplatePart = Omit<TextItem, 'id' | 'startMs' | 'endMs'> & { delayMs?: number; durMs?: number }
export type TitleTemplate = { id: string; label: string; parts: TemplatePart[]; category?: string }
const blockIn = (type: TextAnimEdgeType, durMs = 500) => ({ type, unit: 'block' as const, durMs })
type TextAnimEdgeType = NonNullable<TextAnim['in']>['type']

export const TITLE_TEMPLATES: TitleTemplate[] = [
  {
    id: 'pop_title',
    label: 'Pop title',
    parts: [{
      text: 'BIG NEWS', x: 50, y: 40,
      style: { font: 'Anton', size: 150, color: '#FACC15', align: 'center', case: 'upper', stroke: { color: '#000000', width: 10 } },
      anim: { in: blockIn('pop', 450), out: blockIn('zoom', 350), loop: { type: 'pulse', periodMs: 1200 } },
    }],
  },
  {
    id: 'typewriter',
    label: 'Typewriter',
    parts: [{
      text: 'Here is the thing…', x: 50, y: 40,
      style: { font: 'Poppins', size: 84, color: '#FFFFFF', align: 'center', case: 'none', box: { color: '#000000', opacity: 80, pad: 16 } },
      anim: { in: { type: 'typewriter', unit: 'char', durMs: 1200 }, out: blockIn('fade', 300) },
    }],
  },
  {
    id: 'word_pop',
    label: 'Word by word',
    parts: [{
      text: 'WAIT FOR IT', x: 50, y: 40,
      style: { font: 'Montserrat', size: 110, color: '#FFFFFF', align: 'center', case: 'upper', box: { color: '#E11D48', opacity: 100, pad: 14 } },
      anim: { in: { type: 'pop', unit: 'word', durMs: 900 }, out: { type: 'fade', unit: 'word', durMs: 500 } },
    }],
  },
  {
    id: 'gradient_glow',
    label: 'Gradient',
    parts: [{
      text: 'LEVEL UP', x: 50, y: 40,
      style: { font: 'Luckiest Guy', size: 140, color: '#FFFFFF', align: 'center', case: 'upper', stroke: { color: '#0F172A', width: 8 }, gradient: { from: '#22D3EE', to: '#A855F7', dir: 'v' }, letterSpacing: 6 },
      anim: { in: blockIn('zoom', 500), out: blockIn('fade', 400), loop: { type: 'bounce', periodMs: 1400 } },
    }],
  },
  {
    id: 'lower_third',
    label: 'Lower third',
    parts: [
      {
        text: '', kind: 'shape', shape: { type: 'rounded', w: 640, h: 170 }, x: 38, y: 80,
        style: { ...PLAIN_STYLE, color: '#1D4ED8' },
        anim: { in: blockIn('slide_right', 450), out: blockIn('slide_left', 400) },
      },
      {
        text: 'Your Name\n<i>Title · Company</i>', x: 38, y: 80, delayMs: 150,
        style: { font: 'Poppins', size: 56, color: '#FFFFFF', align: 'center', case: 'none', lineHeight: 1.1, shadow: { color: '#000000', opacity: 75, dist: 4 } },
        anim: { in: blockIn('slide_right', 450), out: blockIn('slide_left', 400) },
      },
    ],
  },
  {
    id: 'subscribe',
    label: 'Subscribe',
    parts: [
      {
        text: '', kind: 'shape', shape: { type: 'rounded', w: 560, h: 150 }, x: 50, y: 72,
        style: { ...PLAIN_STYLE, color: '#DC2626' },
        anim: { in: blockIn('pop', 400), out: blockIn('zoom', 300) },
      },
      {
        text: 'SUBSCRIBE', x: 50, y: 72,
        style: { font: 'Archivo Black', size: 72, color: '#FFFFFF', align: 'center', case: 'upper', letterSpacing: 4 },
        anim: { in: blockIn('pop', 400), out: blockIn('zoom', 300) },
      },
      {
        text: '', kind: 'sticker', sticker: 'pointer', x: 70, y: 78, delayMs: 400,
        style: { ...PLAIN_STYLE, size: 180 },
        anim: { in: blockIn('slide_up', 400), out: blockIn('fade', 300), loop: { type: 'bounce', periodMs: 900 } },
      },
    ],
  },
  {
    id: 'speech_bubble',
    label: 'Speech bubble',
    parts: [
      {
        text: '',
        kind: 'shape',
        shape: { type: 'rounded', w: 1152, h: 346 },
        x: 50,
        y: 30,
        style: { ...PLAIN_STYLE, color: '#FFFFFF' },
      },
      {
        text: 'Say something!',
        x: 50,
        y: 30,
        style: { font: 'Poppins', size: 72, color: '#111111', align: 'center', case: 'none' },
        anim: { in: blockIn('pop', 400), out: blockIn('fade', 300) },
      },
    ],
  },
  ...CATALOG_TEMPLATES,
]

/** Template → items at the playhead (ids from `mkId`), clamped to the clip like "Add text". */
export function newTemplateItems(templateId: string, mkId: () => string, playheadMs: number, clipEndMs: number): TextItem[] {
  const tpl = TITLE_TEMPLATES.find((t) => t.id === templateId)
  if (!tpl) return []
  const [a] = itemWindow(playheadMs, clipEndMs)
  // E9: the last delayed part must still get its full play duration. The old
  // shared 3s window clamped late countdown numbers to the same end frame.
  return tpl.parts.map(({ delayMs, durMs, ...p }) => {
    // E9: the first frame of these templates must actually paint at the
    // insertion playhead; pop/zoom entrances otherwise start fully invisible.
    // Later countdown numbers retain their timed entrances.
    const immediate = (delayMs ?? 0) === 0 &&
      (templateId === 'c_qs_quote' || templateId === 'c_qs_stat' || templateId === 'c_cd_321')
    const s = Math.min(Math.max(0, clipEndMs - TEXT_MIN_MS), a + (delayMs ?? 0))
    const end = Math.min(clipEndMs, s + Math.max(TEXT_MIN_MS, durMs ?? TEXT_DEFAULT_MS))
    const parsed = p.kind ? null : parseInlineMarks(p.text)
    return {
      ...p,
      ...(parsed ? { text: parsed.text, ...(parsed.marks.length ? { marks: parsed.marks } : {}) } : {}),
      id: mkId(),
      startMs: Math.max(a, s),
      endMs: end,
      style: { ...p.style },
      ...(immediate && p.anim?.in ? { anim: { ...p.anim, in: undefined } } : {}),
    } as TextItem
  })
}

/** E9: keep a newly added template's parts together and move the entire group
 * away from other text at this playhead; never flatten their deliberately
 * different relative positions or their staggered entrance times. */
export function placeTemplateGroupInClearSpace(existing: readonly TextItem[], group: TextItem[]): TextItem[] {
  if (!group.length || !existing.length) return group
  const overlapsTime = (a: TextItem, b: TextItem) => a.startMs < b.endMs && b.startMs < a.endMs
  // E9: center-point proximity is not a collision test. A wide quote can
  // intersect a stat even when their anchors are 20% apart.
  const box = (it: TextItem) => {
    const lines = (it.text || ' ').split('\n')
    const size = it.style?.size ?? 96
    const width = it.kind === 'shape' && it.shape
      ? it.shape.w / 19.2
      : Math.min(92, Math.max(8, Math.max(...lines.map(l => l.length)) * size * 0.55 / 34.13))
    const height = it.kind === 'shape' && it.shape
      ? it.shape.h / 19.2
      : Math.min(70, Math.max(6, lines.length * size * 1.15 / 19.2))
    return { l: it.x - width / 2, r: it.x + width / 2, t: it.y - height / 2, b: it.y + height / 2 }
  }
  const overlap = (a: TextItem, b: TextItem) => {
    if (!overlapsTime(a, b)) return 0
    const x = box(a), y = box(b)
    return Math.max(0, Math.min(x.r, y.r) - Math.max(x.l, y.l)) *
      Math.max(0, Math.min(x.b, y.b) - Math.max(x.t, y.t))
  }
  const minX = Math.min(...group.map(it => it.x))
  const maxX = Math.max(...group.map(it => it.x))
  const minY = Math.min(...group.map(it => it.y))
  const maxY = Math.max(...group.map(it => it.y))
  const shifts = [
    [0, 0], [-30, 0], [30, 0], [0, -28], [0, 28],
    [-30, -28], [30, -28], [-30, 28], [30, 28],
    [0, -42], [0, 42], [-42, 0], [42, 0],
    [-42, -28], [42, -28], [-42, 28], [42, 28],
  ]
  let best = group
  let bestScore = Infinity
  for (const [wantX, wantY] of shifts) {
    // Move the entire multi-part layout by the same amount, preserving
    // quote/attribution alignment and countdown relative coordinates.
    const dx = Math.max(5 - minX, Math.min(95 - maxX, wantX!))
    const dy = Math.max(5 - minY, Math.min(95 - maxY, wantY!))
    const candidate = group.map(it => ({ ...it, x: it.x + dx, y: it.y + dy }))
    const score = candidate.reduce((sum, it) =>
      sum + existing.reduce((n, old) => n + overlap(it, old), 0), 0)
    if (score < bestScore) {
      best = candidate
      bestScore = score
    }
    if (score === 0) return candidate
  }
  return best
}

/** `<b>` / `<i>` inline tags → plain text + marks (used by templates only). */
export function parseInlineMarks(src: string): { text: string; marks: TextMark[] } {
  const flags: number[] = []
  const chars: string[] = []
  let cur = 0
  const re = /<(\/?)([bi])>/gi
  let last = 0
  let m: RegExpExecArray | null
  const push = (seg: string) => {
    for (const c of Array.from(seg)) {
      chars.push(c)
      flags.push(cur)
    }
  }
  while ((m = re.exec(src))) {
    push(src.slice(last, m.index))
    const bit = m[2]!.toLowerCase() === 'b' ? 1 : 2
    cur = m[1] ? cur & ~bit : cur | bit
    last = m.index + m[0].length
  }
  push(src.slice(last))
  return { text: chars.join(''), marks: flagsToMarks(flags) }
}
