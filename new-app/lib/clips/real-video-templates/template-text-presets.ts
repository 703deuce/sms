/**
 * CapCut-style template text: style + animation presets compiled into ClipEditsV2 text layers.
 * Browser preview (libass-wasm) and worker (text_items.py) share the same style fields.
 */
import type { TextAnim } from '@/lib/clips/render-plan/text-anim'
import type { TextMark } from '@/lib/clips/render-plan/text-rich'
import type { TemplateText, TemplateTextFinish } from './sequence-contract'

export type TemplateTextStylePreset = {
  id: string
  label: string
  /** Mini swatch for the studio picker */
  swatch: { fill: string; stroke?: string; accent?: string }
  finish: TemplateTextFinish
  case: 'upper' | 'none'
}

export type TemplateTextAnimPreset = {
  id: string
  label: string
  /** Short motion hint for thumbnail (CSS) */
  motion: 'pop' | 'slide' | 'fade' | 'type' | 'bounce' | 'zoom'
  anim: TextAnim
}

const stroke = (w: number, color = '#000000'): TemplateTextFinish['stroke'] => ({ color, width: w })
const shadow = (dist: number, opacity = 78, color = '#000000'): TemplateTextFinish['shadow'] => ({
  color, opacity, dist,
})
const box = (color: string, opacity: number, pad: number): NonNullable<TemplateTextFinish['box']> => ({
  color, opacity, pad,
})

/** Reusable CapCut-like finishes; stroke widths are px @ 1920h (≈6–10% of hook size). */
export const TEMPLATE_TEXT_STYLE_PRESETS: readonly TemplateTextStylePreset[] = [
  {
    id: 'hook_punch',
    label: 'Hook punch',
    swatch: { fill: '#FFFFFF', stroke: '#09090B', accent: '#FACC15' },
    case: 'upper',
    finish: { stroke: stroke(10, '#09090B'), shadow: shadow(5, 82), letterSpacing: 2 },
  },
  {
    id: 'hook_neon',
    label: 'Neon hook',
    swatch: { fill: '#67E8F9', stroke: '#0F172A', accent: '#F0ABFC' },
    case: 'upper',
    finish: { stroke: stroke(9, '#0F172A'), shadow: shadow(4, 90, '#164E63'), letterSpacing: 1.5 },
  },
  {
    id: 'hook_label',
    label: 'Label box',
    swatch: { fill: '#FFFFFF', stroke: '#000000', accent: '#FACC15' },
    case: 'upper',
    finish: { stroke: stroke(8), shadow: shadow(4, 75), box: box('#0F172A', 88, 14), letterSpacing: 1 },
  },
  {
    id: 'hook_soft',
    label: 'Soft shadow',
    swatch: { fill: '#FFFFFF', accent: '#E2E8F0' },
    case: 'upper',
    finish: { shadow: shadow(6, 72), letterSpacing: 0.5 },
  },
  {
    id: 'hook_script',
    label: 'Script accent',
    swatch: { fill: '#FFF7ED', stroke: '#431407', accent: '#FDBA74' },
    case: 'none',
    finish: { stroke: stroke(6, '#431407'), shadow: shadow(4, 70, '#431407'), letterSpacing: 0.3 },
  },
  {
    id: 'line_accent',
    label: 'Accent line',
    swatch: { fill: '#FDE047', stroke: '#09090B' },
    case: 'upper',
    finish: { stroke: stroke(7, '#09090B'), shadow: shadow(3, 76), letterSpacing: 1.2 },
  },
  {
    id: 'line_pill',
    label: 'Pill closing',
    swatch: { fill: '#FFFFFF', accent: '#FB7185' },
    case: 'upper',
    finish: { box: box('#18181B', 82, 12), shadow: shadow(3, 70), letterSpacing: 0.8 },
  },
  {
    id: 'line_minimal',
    label: 'Minimal',
    swatch: { fill: '#FFFFFF', accent: '#94A3B8' },
    case: 'none',
    finish: { stroke: stroke(5, '#020617'), shadow: shadow(3, 65), letterSpacing: 0.4 },
  },
] as const

export const TEMPLATE_TEXT_ANIM_PRESETS: readonly TemplateTextAnimPreset[] = [
  {
    id: 'pop_overshoot',
    label: 'Pop overshoot',
    motion: 'pop',
    anim: { in: { type: 'pop', unit: 'block', durMs: 250 }, out: { type: 'fade', unit: 'block', durMs: 220 } },
  },
  {
    id: 'pop_words',
    label: 'Word pop',
    motion: 'pop',
    anim: { in: { type: 'pop', unit: 'word', durMs: 280 }, out: { type: 'zoom_out', unit: 'block', durMs: 240 } },
  },
  {
    id: 'slide_up_fade',
    label: 'Slide up',
    motion: 'slide',
    anim: { in: { type: 'slide_up', unit: 'block', durMs: 320 }, out: { type: 'fade', unit: 'block', durMs: 260 } },
  },
  {
    id: 'typewriter_hook',
    label: 'Typewriter',
    motion: 'type',
    anim: { in: { type: 'typewriter', unit: 'char', durMs: 650 }, out: { type: 'fade', unit: 'block', durMs: 200 } },
  },
  {
    id: 'bounce_energy',
    label: 'Bounce',
    motion: 'bounce',
    anim: {
      in: { type: 'bounce_in', unit: 'block', durMs: 380 },
      out: { type: 'fade', unit: 'block', durMs: 240 },
      loop: { type: 'pulse', periodMs: 1600 },
    },
  },
  {
    id: 'zoom_punch',
    label: 'Zoom punch',
    motion: 'zoom',
    anim: { in: { type: 'zoom', unit: 'block', durMs: 260 }, out: { type: 'zoom_out', unit: 'block', durMs: 220 } },
  },
  {
    id: 'fade_steady',
    label: 'Fade',
    motion: 'fade',
    anim: { in: { type: 'fade', unit: 'line', durMs: 400 }, out: { type: 'fade', unit: 'block', durMs: 280 } },
  },
  {
    id: 'whip_words',
    label: 'Whip words',
    motion: 'slide',
    anim: { in: { type: 'pop', unit: 'word', durMs: 300 }, out: { type: 'slide_left', unit: 'block', durMs: 260 } },
  },
] as const

export type Batch9AnchorTextDesign = {
  headline: {
    stylePresetId: string
    animPresetId: string
    font: string
    y: number
    marks?: TextMark[]
  }
  closing: {
    stylePresetId: string
    animPresetId: string
    font: string
    y: number
    colorFromAccent?: boolean
  }
}

/** Distinct CapCut-like pairing per Batch 9A anchor (f01–f10). */
export const BATCH9A_ANCHOR_TEXT_DESIGN: Readonly<Record<string, Batch9AnchorTextDesign>> = {
  f01: {
    headline: { stylePresetId: 'hook_punch', animPresetId: 'pop_overshoot', font: 'Anton', y: 50 },
    closing: { stylePresetId: 'line_accent', animPresetId: 'slide_up_fade', font: 'Montserrat', y: 76, colorFromAccent: true },
  },
  f02: {
    headline: { stylePresetId: 'hook_soft', animPresetId: 'fade_steady', font: 'Bebas Neue', y: 50 },
    closing: { stylePresetId: 'line_minimal', animPresetId: 'fade_steady', font: 'Inter', y: 74, colorFromAccent: true },
  },
  f03: {
    headline: { stylePresetId: 'hook_neon', animPresetId: 'zoom_punch', font: 'Archivo Black', y: 50 },
    closing: { stylePresetId: 'line_pill', animPresetId: 'pop_words', font: 'Space Mono', y: 78, colorFromAccent: true },
  },
  f04: {
    headline: { stylePresetId: 'hook_script', animPresetId: 'slide_up_fade', font: 'Pacifico', y: 50 },
    closing: { stylePresetId: 'line_minimal', animPresetId: 'fade_steady', font: 'Poppins', y: 72, colorFromAccent: true },
  },
  f05: {
    headline: { stylePresetId: 'hook_punch', animPresetId: 'pop_words', font: 'Montserrat', y: 50 },
    closing: { stylePresetId: 'line_minimal', animPresetId: 'slide_up_fade', font: 'Space Grotesk', y: 76 },
  },
  f06: {
    headline: { stylePresetId: 'hook_label', animPresetId: 'bounce_energy', font: 'Bangers', y: 50 },
    closing: { stylePresetId: 'hook_script', animPresetId: 'whip_words', font: 'Caveat', y: 74, colorFromAccent: true },
  },
  f07: {
    headline: { stylePresetId: 'hook_punch', animPresetId: 'pop_words', font: 'Luckiest Guy', y: 50 },
    closing: { stylePresetId: 'line_pill', animPresetId: 'slide_up_fade', font: 'Baloo 2', y: 77, colorFromAccent: true },
  },
  f08: {
    headline: { stylePresetId: 'hook_soft', animPresetId: 'fade_steady', font: 'Playfair Display', y: 50 },
    closing: { stylePresetId: 'line_minimal', animPresetId: 'fade_steady', font: 'Montserrat', y: 75 },
  },
  f09: {
    headline: { stylePresetId: 'hook_punch', animPresetId: 'pop_overshoot', font: 'Fira Sans Condensed', y: 50 },
    closing: { stylePresetId: 'line_accent', animPresetId: 'zoom_punch', font: 'Rubik', y: 78, colorFromAccent: true },
  },
  f10: {
    headline: { stylePresetId: 'hook_label', animPresetId: 'typewriter_hook', font: 'Gabarito', y: 50 },
    closing: { stylePresetId: 'line_pill', animPresetId: 'fade_steady', font: 'Space Grotesk', y: 76, colorFromAccent: true },
  },
}

const styleById = new Map(TEMPLATE_TEXT_STYLE_PRESETS.map((p) => [p.id, p]))
const animById = new Map(TEMPLATE_TEXT_ANIM_PRESETS.map((p) => [p.id, p]))

export function templateTextStylePreset(id: string): TemplateTextStylePreset | undefined {
  return styleById.get(id)
}

export function templateTextAnimPreset(id: string): TemplateTextAnimPreset | undefined {
  return animById.get(id)
}

export function resolveTemplateTextLayer(
  base: Pick<TemplateText, 'id' | 'defaultText' | 'maxChars' | 'startFrame' | 'durationFrames' | 'size' | 'color'> & {
    x: number
    y: number
    font: string
    finish?: TemplateTextFinish
    anim?: TextAnim
    case?: 'upper' | 'none'
    stylePresetId?: string
    animPresetId?: string
    marks?: TextMark[]
    colorFromAccent?: boolean
  },
  accentColor: string,
): TemplateText {
  const styleId = base.stylePresetId ?? 'hook_punch'
  const animId = base.animPresetId ?? 'pop_overshoot'
  const stylePreset = templateTextStylePreset(styleId)
  const animPreset = templateTextAnimPreset(animId)
  if (!stylePreset || !animPreset) throw new Error(`Unknown template text preset: ${styleId}/${animId}`)
  const color = base.color === '__accent__' || base.colorFromAccent ? accentColor : base.color
  return {
    id: base.id,
    defaultText: base.defaultText,
    maxChars: base.maxChars,
    startFrame: base.startFrame,
    durationFrames: base.durationFrames,
    x: base.x,
    y: base.y,
    font: base.font,
    size: base.size,
    color,
    case: base.case ?? stylePreset.case,
    stylePresetId: styleId,
    animPresetId: animId,
    finish: { ...stylePreset.finish, ...(base.finish ?? {}) },
    anim: base.anim ?? animPreset.anim,
    ...(base.marks?.length ? { marks: base.marks } : {}),
  }
}

/** Emphasis on the last word of hook copy (bold) for punch templates. */
export function lastWordBoldMark(text: string): TextMark[] | undefined {
  const words = text.trim().split(/\s+/)
  if (words.length < 2) return undefined
  const last = words[words.length - 1]!
  const start = text.lastIndexOf(last)
  if (start < 0) return undefined
  return [{ s: start, e: start + Array.from(last).length, b: true }]
}
