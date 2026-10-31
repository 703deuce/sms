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
import { normAnim, type TextAnim } from '@/lib/clips/render-plan/text-anim'

export type TextAlign = 'left' | 'center' | 'right'
export type TextCase = 'none' | 'upper'

export type TextStroke = { color: string; width: number }
export type TextShadow = { color: string; opacity: number; dist: number }
export type TextBox = { color: string; opacity: number; pad: number }

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
}

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
] as const
export type TextFontId = (typeof TEXT_FONTS)[number]['id']
const FONT_IDS = TEXT_FONTS.map((f) => f.id) as readonly string[]

export const TEXT_SIZE_MIN = 24
export const TEXT_SIZE_MAX = 240
export const TEXT_MIN_MS = 300
export const TEXT_DEFAULT_MS = 3000
export const TEXT_MAX_CHARS = 200
export const TEXT_MAX_ITEMS = 30

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

export function normalizeTextStyle(raw: unknown): TextStyle {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const d = DEFAULT_TEXT_STYLE
  const style: TextStyle = {
    font: (typeof o.font === 'string' && FONT_IDS.includes(o.font) ? o.font : d.font) as TextFontId,
    size: Math.round(num(o.size, TEXT_SIZE_MIN, TEXT_SIZE_MAX, d.size)),
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
    const text = String(o.text ?? '').replace(/\r/g, '').slice(0, TEXT_MAX_CHARS)
    if (!id || seen.has(id) || !/^[A-Za-z0-9_~-]+$/.test(id) || !text.trim()) continue
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
      style: normalizeTextStyle(o.style),
    }
    if (typeof o.presetId === 'string' && o.presetId.length <= 64) item.presetId = o.presetId
    const anim = normAnim(o.anim)
    if (anim) item.anim = anim
    out.push(item)
    if (out.length >= TEXT_MAX_ITEMS) break
  }
  return out.length ? out.sort((p, q) => p.startMs - q.startMs) : undefined
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
