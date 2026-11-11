/**
 * Batch 7 opt-in, deterministic primitives for standalone template composition.
 * Emits ordinary TextItem + text keyframe tracks consumed by BOTH the browser
 * and ASS/FFmpeg worker. This file deliberately does not touch editor timelines.
 *
 * Not a depth/cutout renderer: images and photo occlusion need separately
 * licensed, verified foreground/background preparation.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { TextItem, TextFontId } from '@/lib/clips/editor/text-items'
import { normalizeTextItems, TEXT_MAX_ITEMS, TEXT_MAX_CHARS, TEXT_FONTS } from '@/lib/clips/editor/text-items'
import type { KeyframeTrack } from '@/lib/clips/editor/motion-schema'
import { fitMotionTextToBox, type MotionTextFormat } from '@/lib/clips/motion-graphics/text-fit'

export type PrimitiveKind =
  | 'collage_card' | 'confetti' | 'countdown' | 'before_after'
  | 'roster' | 'calendar' | 'route_arrow' | 'underline' | 'line_reveal'
  | 'text_glow'

export type TemplatePrimitive = {
  id: string
  kind: PrimitiveKind
  startMs: number
  endMs: number
  box: { x: number; y: number; width: number; height: number }
  color: string
  accent: string
  font: TextFontId
  text?: string
  labels?: string[]
  /** Reduced motion removes movement, not content. */
  reducedMotion?: boolean
}
type Result = { ok: true; edits: ClipEditsV2; itemIds: string[] } |
  { ok: false; code: string; detail: string }

const KINDS = new Set<PrimitiveKind>([
  'collage_card','confetti','countdown','before_after','roster','calendar',
  'route_arrow','underline','line_reveal','text_glow',
])
const COLOR = /^#[0-9a-fA-F]{6}$/
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,35}$/
const FONTS = new Set<string>(TEXT_FONTS.map(f => f.id))
const MAX_PRIMITIVES = 12
const MAX_LAYERS_PER_PRIMITIVE = 18
const min = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const at = (n: number) => Math.round(n * 10) / 10

function valid(p: TemplatePrimitive, durationMs: number): string | null {
  if (!p || !ID.test(p.id) || !KINDS.has(p.kind)) return 'unsupported_primitive'
  if (!Number.isInteger(p.startMs) || !Number.isInteger(p.endMs) ||
      p.startMs < 0 || p.endMs - p.startMs < 300 || p.endMs > durationMs)
    return 'invalid_duration'
  const b = p.box
  if (!b || ![b.x,b.y,b.width,b.height].every(Number.isFinite) ||
      b.x < 0 || b.y < 0 || b.width <= 0 || b.height <= 0 ||
      b.x + b.width > 1 || b.y + b.height > 1) return 'invalid_box'
  if (!COLOR.test(p.color) || !COLOR.test(p.accent)) return 'invalid_color'
  if (!FONTS.has(p.font)) return 'unavailable_font'
  if (p.text != null && (typeof p.text !== 'string' || Array.from(p.text).length > TEXT_MAX_CHARS))
    return 'invalid_text'
  if (p.labels != null && (!Array.isArray(p.labels) || p.labels.length > 8 ||
      p.labels.some(s => typeof s !== 'string' || !s.trim() || Array.from(s).length > 60)))
    return 'invalid_labels'
  if (p.reducedMotion != null && typeof p.reducedMotion !== 'boolean') return 'invalid_motion'
  return null
}

function compileOne(p: TemplatePrimitive, format: MotionTextFormat) {
  const b = p.box
  const cx = at((b.x + b.width / 2) * 100)
  const cy = at((b.y + b.height / 2) * 100)
  const pxWidth = (format === '9:16' ? 1080 : format === '1:1' ? 1920 : 3413)
  const items: TextItem[] = []
  const tracks: KeyframeTrack[] = []
  const duration = p.endMs - p.startMs
  const anim = p.reducedMotion ? undefined : {
    in: { type: 'fade' as const, unit: 'block' as const, durMs: min(duration / 5, 100, 450) },
    out: { type: 'fade' as const, unit: 'block' as const, durMs: min(duration / 5, 100, 450) },
  }
  const base = 'b7_' + p.id + '__'
  const addShape = (suffix: string, shape: 'rect'|'rounded'|'circle'|'arrow',
    x: number, y: number, w: number, h: number, color = p.accent) => {
    const item: TextItem = {
      id: base + suffix, startMs: p.startMs, endMs: p.endMs,
      x: at(x), y: at(y), text: '', kind: 'shape',
      shape: { type: shape, w: Math.round(min(w, 8, 3840)), h: Math.round(min(h, 8, 3840)) },
      style: { font: p.font, size: 36, color, align: 'center', case: 'none' },
      ...(anim ? { anim } : {}),
    }
    items.push(item)
    return item
  }
  const addText = (suffix: string, text: string, x: number, y: number,
    boxWidth = b.width, boxHeight = b.height, color = p.color) => {
    const fit = fitMotionTextToBox({
      text, fontFamily: p.font, format,
      box: { width: boxWidth, height: boxHeight },
      preferredSize: min(boxHeight * 1920 * 0.38, 28, 100),
    })
    if (!fit.fits) throw new Error('text_does_not_fit:' + suffix)
    const item: TextItem = {
      id: base + suffix, startMs: p.startMs, endMs: p.endMs,
      x: at(x), y: at(y), text: fit.text,
      style: { font: p.font, size: fit.size, color, align: 'center', case: 'none',
        stroke: { color: '#000000', width: 2 } },
      ...(anim ? { anim } : {}),
    }
    items.push(item)
    return item
  }
  const move = (item: TextItem, prop: 'x'|'y'|'scale'|'opacity', from: number, to: number) => {
    if (p.reducedMotion) return
    tracks.push({ target: 'text:' + item.id, prop,
      value: from, points: [{ tMs: 0, v: from }, { tMs: duration, v: to }] })
  }
  const text = p.text?.trim() || ''
  const labels = p.labels ?? []
  switch (p.kind) {
    case 'collage_card': {
      addShape('frame','rounded',cx,cy,b.width * pxWidth,b.height * 1920,p.accent)
      if (text) addText('caption',text,cx,at((b.y+b.height*.82)*100),b.width*.86,b.height*.22)
      break
    }
    case 'confetti': {
      // Fixed seeded original dots: no randomness, flashing, model, or external assets.
      for (let i=0; i<12; i++) {
        const x = (b.x + b.width * ((i*37+11)%97)/97)*100
        const y = (b.y + b.height * ((i*53+17)%89)/89)*100
        const dot = addShape('dot_'+i,i%3===0?'circle':'rect',x,y,
          min(pxWidth*b.width*.025,8,44),min(1920*b.height*.025,8,44),
          i%2 ? p.accent : p.color)
        move(dot,'y',-7,5)
      }
      break
    }
    case 'countdown': {
      // Deliberately static numeral per interval. This is NOT numeric count_up.
      const n = Number(text)
      if (!/^\d{1,2}$/.test(text) || !Number.isInteger(n))
        throw new Error('countdown_requires_one_static_numeral')
      addShape('ring','circle',cx,cy,Math.min(b.width*pxWidth,b.height*1920),
        Math.min(b.width*pxWidth,b.height*1920),p.accent)
      addText('number',text,cx,cy,b.width*.66,b.height*.62,p.color)
      break
    }
    case 'before_after': {
      if (labels.length !== 2) throw new Error('before_after_requires_two_labels')
      addShape('divider','rect',cx,cy,8,b.height*1920,p.accent)
      addText('before',labels[0]!,at((b.x+b.width*.25)*100),
        at((b.y+b.height*.15)*100),b.width*.45,b.height*.25)
      addText('after',labels[1]!,at((b.x+b.width*.75)*100),
        at((b.y+b.height*.15)*100),b.width*.45,b.height*.25)
      break
    }
    case 'roster': {
      if (labels.length < 2 || labels.length > 5) throw new Error('roster_requires_2_to_5_labels')
      labels.forEach((label,i) => {
        const y = (b.y + b.height*(i+.5)/labels.length)*100
        addShape('panel_'+i,'rounded',cx,y,b.width*pxWidth*.92,
          b.height*1920/labels.length*.72,i===0?p.accent:'#0F172A')
        addText('player_'+i,label,cx,y,b.width*.80,b.height/labels.length*.60)
      })
      break
    }
    case 'calendar': {
      if (!text) throw new Error('calendar_requires_label')
      addShape('calendar_card','rounded',cx,cy,b.width*pxWidth,b.height*1920,'#0F172A')
      addShape('header','rect',cx,at((b.y+b.height*.18)*100),b.width*pxWidth*.92,
        b.height*1920*.24,p.accent)
      addText('date',text,cx,at((b.y+b.height*.62)*100),b.width*.86,b.height*.58)
      break
    }
    case 'route_arrow': {
      const arrow = addShape('arrow','arrow',cx,cy,b.width*pxWidth*.8,b.height*1920*.5)
      move(arrow,'x',-8,0)
      if (text) addText('label',text,cx,at((b.y+b.height*.83)*100),b.width*.8,b.height*.25)
      break
    }
    case 'underline':
    case 'line_reveal': {
      if (!text) throw new Error('line_requires_text')
      addText('title',text,cx,at((b.y+b.height*.38)*100),b.width*.92,b.height*.65)
      const line = addShape('line','rect',cx,at((b.y+b.height*.80)*100),
        b.width*pxWidth*.76,min(b.height*1920*.055,8,52))
      // A static underline in reduced-motion mode; existing keyframe engine
      // controls non-flashing movement for the standard alternative.
      move(line,'scale',10,100)
      break
    }
    case 'text_glow': {
      if (!text) throw new Error('glow_requires_text')
      const t = addText('glow',text,cx,cy,b.width*.95,b.height*.9)
      t.style.shadow = { color: p.accent, opacity: 75, dist: 3 }
      break
    }
  }
  if (items.length > MAX_LAYERS_PER_PRIMITIVE) throw new Error('primitive_layer_limit')
  return { items, tracks }
}

/** All-or-nothing. Does not evict unrelated manual text/groups/keyframes. */
export function applyStandaloneTemplatePrimitives(
  edits: ClipEditsV2, primitives: readonly TemplatePrimitive[],
  format: MotionTextFormat, durationMs: number,
): Result {
  if (!['9:16','1:1','16:9'].includes(format) || !Number.isInteger(durationMs) || durationMs < 300)
    return { ok: false, code: 'invalid_canvas', detail: 'Unsupported frame format/duration' }
  if (primitives.length > MAX_PRIMITIVES)
    return { ok: false, code: 'primitive_count', detail: 'Maximum 12 primitives' }
  const ids = new Set<string>()
  for (const p of primitives) {
    const error = valid(p, durationMs)
    if (error) return { ok: false, code: error, detail: String(p?.id) }
    if (ids.has(p.id)) return { ok: false, code: 'duplicate_id', detail: p.id }
    ids.add(p.id)
  }
  // Refuse collisions rather than deleting the user's unrelated items.
  const retained = edits.textItems ?? []
  let items: TextItem[] = [], tracks: KeyframeTrack[] = []
  try {
    for (const p of primitives) {
      const result = compileOne(p, format)
      items.push(...result.items)
      tracks.push(...result.tracks)
    }
  } catch (e) {
    return { ok: false, code: 'unsupported_design', detail: String((e as Error).message) }
  }
  if (retained.length + items.length > TEXT_MAX_ITEMS)
    return { ok: false, code: 'text_capacity', detail: '60-item limit, including manual items' }
  const existingIds = new Set(retained.map(item => item.id))
  if (items.some(item => existingIds.has(item.id)))
    return { ok: false, code: 'id_collision', detail: 'Existing text or graphic ID' }
  const normalized = normalizeTextItems([...retained,...items], durationMs) ?? []
  if (normalized.length !== retained.length + items.length)
    return { ok: false, code: 'normalization_loss', detail: 'Would discard or rewrite a layer' }
  // Normalization may canonicalize pre-existing items: do not overwrite them.
  const fresh = normalized.filter(item => !existingIds.has(item.id))
  if (fresh.length !== items.length)
    return { ok: false, code: 'normalization_loss', detail: 'Generated item was lost' }
  return { ok: true, edits: { ...edits, textItems: [...retained,...fresh],
    keyframes: [...(edits.keyframes ?? []),...tracks] }, itemIds: items.map(item => item.id) }
}

export const B7_CAPABILITIES = {
  vectorGraphics: 'TextItem/ASS shapes and keyframes; not yet certified as standalone-template end-to-end',
  depthPhoto: 'unsupported: supplied alpha alone does not establish hole fill or foreground occlusion',
  numericCountUp: 'unsupported: countdown accepts only a static numeral',
  reducedMotion: 'supported by disabling movement and using static visible layers',
  frameParity: 'not certified until decoded-frame browser/FFmpeg golden tests pass',
} as const
