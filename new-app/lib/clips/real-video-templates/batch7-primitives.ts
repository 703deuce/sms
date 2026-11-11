/**
 * Batch 7 standalone real-video-template primitives.
 *
 * DATA only. These primitives compile to the editor's existing TextItem/keyframe
 * and source-segment composite contracts, so the same authoritative edits feed
 * template preview and FFmpeg export. No executable template code is accepted.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import {
  normalizeTextItems,
  TEXT_FONTS,
  TEXT_MAX_ITEMS,
  type BuiltinFontId,
  type TextItem,
} from '@/lib/clips/editor/text-items'
import type { SourceSegmentLayout } from '@/lib/clips/editor/segment-layout'
import {
  fitMotionTextToBox,
  motionReferenceWidth,
  type MotionTextFormat,
} from '@/lib/clips/motion-graphics/text-fit'

type Box = { x: number; y: number; width: number; height: number }
export type Batch7PrimitiveStyle = {
  headlineFont: BuiltinFontId
  bodyFont: BuiltinFontId
  textColor: string
  accentColor: string
  panelColor: string
}
type Base = { id: string; startFrame: number; style: Batch7PrimitiveStyle }
type Timed = Base & { durationFrames: number }

export type Batch7TemplatePrimitive =
  | (Timed & { kind: 'photo_frame'; slotId: string; box: Box; thickness: number })
  | (Timed & { kind: 'collage_card'; slotIds: string[]; title?: string })
  | (Timed & { kind: 'confetti'; box: Box; count: number })
  | (Base & { kind: 'countdown'; from: number; stepFrames: number; box: Box })
  | (Timed & { kind: 'before_after'; leftSlotId: string; rightSlotId: string; leftLabel: string; rightLabel: string })
  | (Timed & { kind: 'roster_selection'; title: string; entries: string[]; selectedIndex: number; box: Box })
  | (Timed & { kind: 'calendar_label'; month: string; day: number; label: string; box: Box })
  | (Timed & { kind: 'route_arrow'; label?: string; box: Box })
  | (Timed & { kind: 'text_underline'; text: string; box: Box })
  | (Timed & { kind: 'text_glow'; text: string; box: Box })

export type Batch7CompileContext = {
  format: MotionTextFormat
  totalFrames: number
  slotToItemIds: Readonly<Record<string, string>>
  slotToSourceIds: Readonly<Record<string, string>>
}
export type Batch7Accessibility = { reducedMotion?: boolean; reducedFlash?: boolean }
export type Batch7CompileResult =
  | { ok: true; edits: ClipEditsV2; addedIds: string[] }
  | { ok: false; code: string; detail: string }

const HEX = /^#[0-9a-fA-F]{6}$/
const ID = /^[A-Za-z0-9_-]{1,32}$/
const SLOT_ID = /^[A-Za-z0-9_-]{1,80}$/
const FONT_IDS = new Set<string>(TEXT_FONTS.map((f) => f.id))
const PRIMITIVE_KINDS = new Set([
  'photo_frame', 'collage_card', 'confetti', 'countdown', 'before_after',
  'roster_selection', 'calendar_label', 'route_arrow', 'text_underline', 'text_glow',
])

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

function exact(o: Record<string, unknown>, keys: readonly string[], context: string) {
  for (const key of Object.keys(o)) if (!keys.includes(key))
    throw new Error(context + ': unsupported field "' + key + '"')
}
function text(v: unknown, max: number, context: string): string {
  if (typeof v !== 'string' || !v.trim() || Array.from(v).length > max)
    throw new Error(context + ': invalid text')
  return v.trim()
}
function id(v: unknown, context: string): string {
  const s = String(v ?? '')
  if (!ID.test(s)) throw new Error(context + ': invalid ID')
  return s
}
function slotId(v: unknown, slots: ReadonlySet<string>, context: string): string {
  const s = String(v ?? '')
  if (!SLOT_ID.test(s) || !slots.has(s)) throw new Error(context + ': unknown slot')
  return s
}
function integer(v: unknown, lo: number, hi: number, context: string): number {
  const n = Number(v)
  if (!Number.isInteger(n) || n < lo || n > hi)
    throw new Error(context + ': expected integer ' + lo + '..' + hi)
  return n
}
function finite(v: unknown, lo: number, hi: number, context: string): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n < lo || n > hi)
    throw new Error(context + ': expected number ' + lo + '..' + hi)
  return n
}
function color(v: unknown, context: string): string {
  const s = String(v ?? '')
  if (!HEX.test(s)) throw new Error(context + ': invalid color')
  return s.toUpperCase()
}
function parseBox(v: unknown, context: string): Box {
  if (!isObject(v)) throw new Error(context + ': expected object')
  exact(v, ['x', 'y', 'width', 'height'], context)
  const out = {
    x: finite(v.x, 0, 1, context + '.x'),
    y: finite(v.y, 0, 1, context + '.y'),
    width: finite(v.width, 0.02, 1, context + '.width'),
    height: finite(v.height, 0.02, 1, context + '.height'),
  }
  if (out.x + out.width > 1.000001 || out.y + out.height > 1.000001)
    throw new Error(context + ': box must fit canvas')
  return out
}
function parseStyle(v: unknown, context: string): Batch7PrimitiveStyle {
  if (!isObject(v)) throw new Error(context + ': expected object')
  exact(v, ['headlineFont', 'bodyFont', 'textColor', 'accentColor', 'panelColor'], context)
  const font = (raw: unknown, field: string): BuiltinFontId => {
    const value = String(raw ?? '')
    if (!FONT_IDS.has(value)) throw new Error(context + '.' + field + ': unavailable render font')
    return value as BuiltinFontId
  }
  return {
    headlineFont: font(v.headlineFont, 'headlineFont'),
    bodyFont: font(v.bodyFont, 'bodyFont'),
    textColor: color(v.textColor, context + '.textColor'),
    accentColor: color(v.accentColor, context + '.accentColor'),
    panelColor: color(v.panelColor, context + '.panelColor'),
  }
}
function frameWindow(o: Record<string, unknown>, total: number, context: string) {
  const startFrame = integer(o.startFrame, 0, Math.max(0, total - 1), context + '.startFrame')
  const durationFrames = integer(o.durationFrames, 9, total, context + '.durationFrames')
  if (startFrame + durationFrames > total) throw new Error(context + ': out of bounds')
  return { startFrame, durationFrames }
}
function parseBase(o: Record<string, unknown>, total: number, context: string) {
  return {
    id: id(o.id, context),
    startFrame: integer(o.startFrame, 0, Math.max(0, total - 1), context + '.startFrame'),
    style: parseStyle(o.style, context + '.style'),
  }
}

export function validateBatch7Primitives(
  raw: unknown,
  totalFrames: number,
  slotIds: ReadonlySet<string>,
): Batch7TemplatePrimitive[] {
  if (!Array.isArray(raw)) throw new Error('primitives: expected array')
  if (raw.length > 24) throw new Error('primitives: authored primitive budget exceeded')
  const seen = new Set<string>()
  const out: Batch7TemplatePrimitive[] = []
  for (const value of raw) {
    if (!isObject(value)) throw new Error('primitive: expected object')
    const kind = String(value.kind ?? '')
    if (!PRIMITIVE_KINDS.has(kind)) throw new Error('primitive: unsupported kind ' + kind)
    const base = parseBase(value, totalFrames, 'primitive')
    if (seen.has(base.id)) throw new Error('primitive: duplicate ID ' + base.id)
    seen.add(base.id)
    if (kind === 'countdown') {
      exact(value, ['kind','id','startFrame','style','from','stepFrames','box'], 'countdown')
      const from = integer(value.from, 1, 9, 'countdown.from')
      const stepFrames = integer(value.stepFrames, 9, 150, 'countdown.stepFrames')
      if (base.startFrame + from * stepFrames > totalFrames) throw new Error('countdown: out of bounds')
      out.push({ ...base, kind, from, stepFrames, box: parseBox(value.box, 'countdown.box') })
      continue
    }
    const window = frameWindow(value, totalFrames, kind)
    if (kind === 'photo_frame') {
      exact(value, ['kind','id','startFrame','durationFrames','style','slotId','box','thickness'], kind)
      out.push({ ...base, ...window, kind, slotId: slotId(value.slotId, slotIds, kind + '.slotId'),
        box: parseBox(value.box, kind + '.box'), thickness: integer(value.thickness, 4, 40, kind + '.thickness') })
    } else if (kind === 'collage_card') {
      exact(value, ['kind','id','startFrame','durationFrames','style','slotIds','title'], kind)
      if (!Array.isArray(value.slotIds) || value.slotIds.length < 2 || value.slotIds.length > 4)
        throw new Error(kind + ': requires 2..4 slots')
      const refs = value.slotIds.map((s) => slotId(s, slotIds, kind + '.slotIds'))
      if (new Set(refs).size !== refs.length) throw new Error(kind + ': duplicate slot')
      const title = value.title == null ? undefined : text(value.title, 70, kind + '.title')
      out.push({ ...base, ...window, kind, slotIds: refs, ...(title ? { title } : {}) })
    } else if (kind === 'confetti') {
      exact(value, ['kind','id','startFrame','durationFrames','style','box','count'], kind)
      out.push({ ...base, ...window, kind, box: parseBox(value.box, kind + '.box'),
        count: integer(value.count, 4, 12, kind + '.count') })
    } else if (kind === 'before_after') {
      exact(value, ['kind','id','startFrame','durationFrames','style','leftSlotId','rightSlotId','leftLabel','rightLabel'], kind)
      const leftSlotId = slotId(value.leftSlotId, slotIds, kind + '.leftSlotId')
      const rightSlotId = slotId(value.rightSlotId, slotIds, kind + '.rightSlotId')
      if (leftSlotId === rightSlotId) throw new Error(kind + ': slots must differ')
      out.push({ ...base, ...window, kind, leftSlotId, rightSlotId,
        leftLabel: text(value.leftLabel, 30, kind + '.leftLabel'),
        rightLabel: text(value.rightLabel, 30, kind + '.rightLabel') })
    } else if (kind === 'roster_selection') {
      exact(value, ['kind','id','startFrame','durationFrames','style','title','entries','selectedIndex','box'], kind)
      if (!Array.isArray(value.entries) || value.entries.length < 2 || value.entries.length > 5)
        throw new Error(kind + ': requires 2..5 entries')
      const entries = value.entries.map((e) => text(e, 36, kind + '.entry'))
      out.push({ ...base, ...window, kind, title: text(value.title, 50, kind + '.title'), entries,
        selectedIndex: integer(value.selectedIndex, 0, entries.length - 1, kind + '.selectedIndex'),
        box: parseBox(value.box, kind + '.box') })
    } else if (kind === 'calendar_label') {
      exact(value, ['kind','id','startFrame','durationFrames','style','month','day','label','box'], kind)
      out.push({ ...base, ...window, kind, month: text(value.month, 12, kind + '.month'),
        day: integer(value.day, 1, 31, kind + '.day'), label: text(value.label, 50, kind + '.label'),
        box: parseBox(value.box, kind + '.box') })
    } else if (kind === 'route_arrow') {
      exact(value, ['kind','id','startFrame','durationFrames','style','label','box'], kind)
      const label = value.label == null ? undefined : text(value.label, 50, kind + '.label')
      out.push({ ...base, ...window, kind, box: parseBox(value.box, kind + '.box'), ...(label ? { label } : {}) })
    } else if (kind === 'text_underline' || kind === 'text_glow') {
      exact(value, ['kind','id','startFrame','durationFrames','style','text','box'], kind)
      out.push({ ...base, ...window, kind, text: text(value.text, 120, kind + '.text'),
        box: parseBox(value.box, kind + '.box') } as Batch7TemplatePrimitive)
    }
  }
  return out
}

const frameMs = (frame: number) => Math.round(frame * 1000 / 30)
const pct = (v: number) => Math.round(v * 1000) / 10
const boxCenter = (box: Box) => ({ x: pct(box.x + box.width / 2), y: pct(box.y + box.height / 2) })

function seededUnit(seed: string, index: number): number {
  let h = 2166136261
  const input = seed + ':' + index
  for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619) }
  h ^= h >>> 13
  h = Math.imul(h, 1274126177)
  return (h >>> 0) / 0xffffffff
}

export function compileBatch7Primitives(
  edits: ClipEditsV2,
  primitives: readonly Batch7TemplatePrimitive[],
  context: Batch7CompileContext,
  accessibility: Batch7Accessibility = {},
): Batch7CompileResult {
  const existing = edits.textItems ?? []
  const generated: TextItem[] = []
  const generatedTracks: NonNullable<ClipEditsV2['keyframes']> = []
  const layoutBySegment = new Map<string, SourceSegmentLayout>()
  const ids = new Set(existing.map((item) => item.id))
  const totalMs = frameMs(context.totalFrames)
  const reducedMotion = accessibility.reducedMotion === true
  const reducedFlash = accessibility.reducedFlash === true

  const generatedId = (primitiveId: string, suffix: string) => 'b7_' + primitiveId + '__' + suffix
  const add = (item: TextItem) => {
    if (ids.has(item.id)) throw new Error('id_collision:' + item.id)
    ids.add(item.id)
    generated.push(item)
  }
  const addTrack = (
    itemId: string,
    prop: 'x' | 'y' | 'scale' | 'rotation' | 'opacity',
    points: Array<{ tMs: number; v: number; ease?: 'in' | 'out' | 'inOut' }>,
  ) => {
    if (!reducedMotion && points.length > 1)
      generatedTracks.push({ target: 'text:' + itemId, prop, points })
  }
  const shape = (
    primitive: Batch7TemplatePrimitive,
    suffix: string,
    type: 'rect' | 'rounded' | 'circle' | 'triangle' | 'star' | 'arrow',
    box: Box,
    fill: string,
  ): TextItem => {
    const center = boxCenter(box)
    return {
      id: generatedId(primitive.id, suffix), text: '', kind: 'shape',
      shape: {
        type,
        w: Math.max(8, Math.round(box.width * motionReferenceWidth(context.format))),
        h: Math.max(8, Math.round(box.height * 1920)),
      },
      startMs: frameMs(primitive.startFrame),
      endMs: frameMs(primitive.startFrame + ('durationFrames' in primitive ? primitive.durationFrames : primitive.from * primitive.stepFrames)),
      x: center.x, y: center.y,
      style: { font: primitive.style.headlineFont, size: 24, color: fill, align: 'center', case: 'none' },
    }
  }
  const fittedText = (
    primitive: Batch7TemplatePrimitive,
    suffix: string,
    value: string,
    box: Box,
    font: BuiltinFontId,
    preferredSize: number,
    options: { color?: string; shadow?: TextItem['style']['shadow']; align?: 'left' | 'center' | 'right' } = {},
  ): TextItem => {
    const fit = fitMotionTextToBox({
      text: value,
      fontFamily: font,
      format: context.format,
      box,
      preferredSize,
      edgeInsetPx: 10,
    })
    if (!fit.fits) throw new Error('text_fit:' + primitive.id + ':' + suffix)
    const center = boxCenter(box)
    return {
      id: generatedId(primitive.id, suffix),
      text: fit.text,
      startMs: frameMs(primitive.startFrame),
      endMs: frameMs(primitive.startFrame + ('durationFrames' in primitive ? primitive.durationFrames : primitive.from * primitive.stepFrames)),
      x: center.x,
      y: center.y,
      style: {
        font,
        size: fit.size,
        color: options.color ?? primitive.style.textColor,
        align: options.align ?? 'center',
        case: 'none',
        ...(options.shadow ? { shadow: options.shadow } : {}),
      },
    }
  }
  const setComposite = (anchorSlot: string, otherSlots: readonly string[], kind: 'side_by_side' | 'grid') => {
    const itemId = context.slotToItemIds[anchorSlot]
    if (!itemId || layoutBySegment.has(itemId)) throw new Error('slot_layout_conflict:' + anchorSlot)
    const sources = otherSlots.map((slot) => context.slotToSourceIds[slot]).filter(Boolean)
    if (sources.length !== otherSlots.length) throw new Error('missing_slot_source:' + anchorSlot)
    const layout: SourceSegmentLayout = kind === 'side_by_side'
      ? { kind, withSourceId: sources[0]!, split: 0.5 }
      : {
          kind,
          withSourceId: sources[0]!,
          withSourceId2: sources[1]!,
          ...(sources[2] ? { withSourceId3: sources[2] } : {}),
        }
    layoutBySegment.set(itemId, layout)
  }
  const frameBorder = (p: Extract<Batch7TemplatePrimitive, { kind: 'photo_frame' }>) => {
    const tX = p.thickness / motionReferenceWidth(context.format)
    const tY = p.thickness / 1920
    const b = p.box
    add(shape(p, 'frame_top', 'rect', { x: b.x, y: b.y, width: b.width, height: tY }, p.style.accentColor))
    add(shape(p, 'frame_bottom', 'rect', { x: b.x, y: b.y + b.height - tY, width: b.width, height: tY }, p.style.accentColor))
    add(shape(p, 'frame_left', 'rect', { x: b.x, y: b.y, width: tX, height: b.height }, p.style.accentColor))
    add(shape(p, 'frame_right', 'rect', { x: b.x + b.width - tX, y: b.y, width: tX, height: b.height }, p.style.accentColor))
  }

  try {
    for (const primitive of primitives) {
      const durationMs = frameMs(
        'durationFrames' in primitive ? primitive.durationFrames : primitive.from * primitive.stepFrames,
      )
      const localEnd = Math.max(1, durationMs - 1)
      switch (primitive.kind) {
        case 'photo_frame':
          frameBorder(primitive)
          break
        case 'collage_card': {
          setComposite(primitive.slotIds[0]!, primitive.slotIds.slice(1), primitive.slotIds.length === 2 ? 'side_by_side' : 'grid')
          const border = { x: 0.015, y: 0.015, width: 0.97, height: 0.97 }
          const fp: Extract<Batch7TemplatePrimitive, { kind: 'photo_frame' }> = {
            ...primitive, kind: 'photo_frame', slotId: primitive.slotIds[0]!, box: border, thickness: 12,
          }
          frameBorder(fp)
          if (primitive.title) add(fittedText(primitive, 'title', primitive.title,
            { x: .08, y: .04, width: .84, height: .10 }, primitive.style.headlineFont, 96))
          break
        }
        case 'confetti': {
          const shapes = ['rect', 'circle', 'triangle', 'star'] as const
          const fills = [primitive.style.accentColor, primitive.style.textColor, primitive.style.panelColor]
          for (let i = 0; i < primitive.count; i++) {
            const size = .018 + seededUnit(primitive.id, i * 5) * .025
            const x = primitive.box.x + seededUnit(primitive.id, i * 5 + 1) * Math.max(.001, primitive.box.width - size)
            const y = primitive.box.y + seededUnit(primitive.id, i * 5 + 2) * Math.max(.001, primitive.box.height * .35)
            const item = shape(primitive, 'confetti_' + i, shapes[i % shapes.length]!,
              { x, y, width: size, height: size }, fills[i % fills.length]!)
            add(item)
            if (!reducedMotion) {
              addTrack(item.id, 'y', [{ tMs: 0, v: 0, ease: 'out' }, { tMs: localEnd, v: 14 }])
              addTrack(item.id, 'rotation', [{ tMs: 0, v: 0 }, { tMs: localEnd, v: i % 2 ? 120 : -120 }])
              if (!reducedFlash)
                addTrack(item.id, 'opacity', [{ tMs: 0, v: 100 }, { tMs: localEnd, v: 0 }])
            }
          }
          break
        }
        case 'countdown': {
          for (let n = primitive.from; n >= 1; n--) {
            const index = primitive.from - n
            const item = fittedText(primitive, 'n_' + n, String(n), primitive.box,
              primitive.style.headlineFont, Math.min(240, primitive.box.height * 1920 * .72))
            item.startMs = frameMs(primitive.startFrame + index * primitive.stepFrames)
            item.endMs = frameMs(primitive.startFrame + (index + 1) * primitive.stepFrames)
            if (!reducedMotion) item.anim = {
              in: { type: 'zoom', unit: 'block', durMs: 100 },
              out: { type: 'fade', unit: 'block', durMs: 100 },
            }
            add(item)
          }
          break
        }
        case 'before_after': {
          setComposite(primitive.leftSlotId, [primitive.rightSlotId], 'side_by_side')
          add(shape(primitive, 'divider', 'rect', { x: .497, y: .08, width: .006, height: .84 }, primitive.style.accentColor))
          add(fittedText(primitive, 'left_label', primitive.leftLabel,
            { x: .05, y: .05, width: .40, height: .09 }, primitive.style.headlineFont, 72))
          add(fittedText(primitive, 'right_label', primitive.rightLabel,
            { x: .55, y: .05, width: .40, height: .09 }, primitive.style.headlineFont, 72))
          break
        }
        case 'roster_selection': {
          add(shape(primitive, 'panel', 'rounded', primitive.box, primitive.style.panelColor))
          const headerH = primitive.box.height * .18
          add(fittedText(primitive, 'title', primitive.title,
            { x: primitive.box.x + .04 * primitive.box.width, y: primitive.box.y + .02 * primitive.box.height,
              width: primitive.box.width * .92, height: headerH },
            primitive.style.headlineFont, Math.min(96, headerH * 1920 * .65)))
          const rowH = primitive.box.height * .72 / primitive.entries.length
          primitive.entries.forEach((entry, index) => {
            const row = {
              x: primitive.box.x + primitive.box.width * .06,
              y: primitive.box.y + primitive.box.height * .22 + rowH * index,
              width: primitive.box.width * .88,
              height: rowH * .85,
            }
            if (index === primitive.selectedIndex)
              add(shape(primitive, 'selected_' + index, 'rounded', row, primitive.style.accentColor))
            add(fittedText(primitive, 'entry_' + index, entry, row, primitive.style.bodyFont,
              Math.min(72, row.height * 1920 * .58),
              { color: index === primitive.selectedIndex ? '#FFFFFF' : primitive.style.textColor }))
          })
          break
        }
        case 'calendar_label': {
          add(shape(primitive, 'card', 'rounded', primitive.box, primitive.style.panelColor))
          const monthBox = { x: primitive.box.x + .08 * primitive.box.width, y: primitive.box.y + .06 * primitive.box.height,
            width: primitive.box.width * .84, height: primitive.box.height * .20 }
          const dayBox = { x: primitive.box.x + .10 * primitive.box.width, y: primitive.box.y + .25 * primitive.box.height,
            width: primitive.box.width * .80, height: primitive.box.height * .40 }
          const labelBox = { x: primitive.box.x + .08 * primitive.box.width, y: primitive.box.y + .68 * primitive.box.height,
            width: primitive.box.width * .84, height: primitive.box.height * .22 }
          add(fittedText(primitive, 'month', primitive.month.toUpperCase(), monthBox, primitive.style.bodyFont, 64,
            { color: primitive.style.accentColor }))
          add(fittedText(primitive, 'day', String(primitive.day), dayBox, primitive.style.headlineFont, 170))
          add(fittedText(primitive, 'label', primitive.label, labelBox, primitive.style.bodyFont, 58))
          break
        }
        case 'route_arrow': {
          const item = shape(primitive, 'arrow', 'arrow', primitive.box, primitive.style.accentColor)
          add(item)
          if (!reducedMotion) {
            addTrack(item.id, 'x', [{ tMs: 0, v: -8, ease: 'out' }, { tMs: Math.min(localEnd, 450), v: 0 }])
            addTrack(item.id, 'scale', [{ tMs: 0, v: 30, ease: 'out' }, { tMs: Math.min(localEnd, 450), v: 100 }])
          }
          if (primitive.label) {
            const lb = { x: primitive.box.x, y: Math.max(0, primitive.box.y - .08), width: primitive.box.width, height: .07 }
            add(fittedText(primitive, 'label', primitive.label, lb, primitive.style.bodyFont, 56))
          }
          break
        }
        case 'text_underline': {
          const textBox = { x: primitive.box.x, y: primitive.box.y, width: primitive.box.width, height: primitive.box.height * .78 }
          add(fittedText(primitive, 'text', primitive.text, textBox, primitive.style.headlineFont,
            Math.min(180, textBox.height * 1920 * .60)))
          const lineBox = {
            x: primitive.box.x + primitive.box.width * .08,
            y: primitive.box.y + primitive.box.height * .82,
            width: primitive.box.width * .84,
            height: Math.max(.004, primitive.box.height * .06),
          }
          const line = shape(primitive, 'underline', 'rect', lineBox, primitive.style.accentColor)
          add(line)
          addTrack(line.id, 'scale', [{ tMs: 0, v: 10, ease: 'out' }, { tMs: Math.min(localEnd, 400), v: 100 }])
          break
        }
        case 'text_glow': {
          add(fittedText(primitive, 'text', primitive.text, primitive.box, primitive.style.headlineFont,
            Math.min(200, primitive.box.height * 1920 * .62), {
              shadow: { color: primitive.style.accentColor, opacity: reducedFlash ? 55 : 85, dist: 2 },
            }))
          break
        }
      }
    }
  } catch (error) {
    const detail = String((error as Error).message)
    const code = detail.includes(':') ? detail.slice(0, detail.indexOf(':')) : 'primitive_compile'
    return { ok: false, code, detail }
  }

  if (existing.length + generated.length > TEXT_MAX_ITEMS)
    return { ok: false, code: 'text_capacity', detail: 'Batch 7 would exceed textItems capacity ' + TEXT_MAX_ITEMS }
  const all = [...existing, ...generated]
  const normalized = normalizeTextItems(all, totalMs) ?? []
  if (normalized.length !== all.length)
    return { ok: false, code: 'text_normalization_failed', detail: 'Batch 7 generated a non-renderable text/shape item' }

  const sourceSegments = edits.sourceSegments?.map((segment) => {
    const layout = layoutBySegment.get(segment.id)
    return layout ? { ...segment, layout } : segment
  })
  if (layoutBySegment.size) {
    const found = new Set((sourceSegments ?? []).filter((s) => layoutBySegment.has(s.id)).map((s) => s.id))
    if (found.size !== layoutBySegment.size)
      return { ok: false, code: 'missing_slot_segment', detail: 'Composite primitive target is missing from sourceSegments' }
  }

  return {
    ok: true,
    edits: {
      ...edits,
      textItems: normalized,
      keyframes: [...(edits.keyframes ?? []), ...generatedTracks],
      ...(sourceSegments ? { sourceSegments } : {}),
    },
    addedIds: generated.map((item) => item.id),
  }
}
