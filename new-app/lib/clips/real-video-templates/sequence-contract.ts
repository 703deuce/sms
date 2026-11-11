/**
 * Batch 3 real-video template contract/compiler.
 *
 * DATA only: definitions never contain executable code or remote URLs. The compiler emits the
 * same ClipEditsV2 lanes the editor already understands: sourceSegments + videoSplits for the
 * Video lane, transitions, textItems/shapes, and audio.music. A neutral silent full-duration
 * carrier supplies the source/output clock; user media is never flattened into it and inserts
 * are forbidden for template assembly.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { SourceSegmentFx, SourceSegmentPlayback, SourceSegmentTransform } from '@/lib/clips/editor/sources'
import { TRANSITION_TYPES, type TransitionType } from '@/lib/clips/editor/motion-schema'
import {
  compileTemplatePlayback,
  playbackRequiredHandleFrames,
  playbackSourceBounds,
  validateTemplatePlaybackSpec,
  type TemplateSlotPlaybackSpec,
} from '@/lib/clips/real-video-templates/slot-playback'
import { TEXT_ANIM_BLOCK_ONLY, TEXT_ANIM_IN_TYPES, TEXT_ANIM_LOOP_TYPES, TEXT_ANIM_UNITS, TEXT_ONLY_ANIM, type TextAnim } from '@/lib/clips/render-plan/text-anim'
import { compileBatch7Primitives, validateBatch7Primitives, type Batch7TemplatePrimitive } from './batch7-primitives'

export type TemplateAsset = {
  id: string
  kind: 'image' | 'video' | 'audio'
  license: { id: string; provenance: 'user-owned' | 'first-party' | 'licensed'; reference: string }
  durationFrames?: number
}
export type TemplateTransition = { type: TransitionType; durationFrames: number }
export type TemplateMotionState = { x?: number; y?: number; scale?: number; rotation?: number }
export type TemplateMotion = {
  from?: TemplateMotionState
  to: TemplateMotionState
  ease?: 'linear' | 'in' | 'out' | 'inOut'
}
export type TemplateSlot = {
  id: string
  ordinal: number
  role: 'hero' | 'support' | 'detail' | 'closing'
  media: 'image' | 'video' | 'either'
  startFrame: number
  durationFrames: number
  sourceInFrame?: number
  /** Required source handles outside the visible slot. */
  handles?: { headFrames: number; tailFrames: number }
  fit: 'cover' | 'contain'
  sourceAudio: 'mute' | 'source'
  /** Fixed output duration; source media advances at this rate. */
  speed?: number
  /** B6 output-local piecewise speed/hold plan. Mutually exclusive with speed. */
  playback?: TemplateSlotPlaybackSpec
  /** Incoming edge. First slot must be cut. */
  transition: 'cut' | TemplateTransition
  /** Output-clock animation compiled to ordinary target=video keyframes. */
  motion?: TemplateMotion
  transform?: SourceSegmentTransform
  fx?: SourceSegmentFx
}
export type TemplateText = {
  id: string
  defaultText: string
  maxChars: number
  startFrame: number
  durationFrames: number
  x: number
  y: number
  font: 'Montserrat' | 'Anton' | 'Poppins'
  size: number
  color: string
  /** Real ASS/worker/libass text choreography, not preview-only CSS. */
  anim?: TextAnim
}
export type TemplateGraphic = {
  id: string
  type: 'rect' | 'rounded' | 'circle' | 'triangle' | 'star' | 'heart' | 'arrow'
  startFrame: number
  durationFrames: number
  x: number
  y: number
  w: number
  h: number
  color: string
  /** Whole-layer animation shares the regular text/graphic renderer. */
  anim?: TextAnim
}
export type TemplatePhraseAnchor = { id: string; frame: number; textFieldId?: string }
export type TemplateFamilyV1 = {
  schemaVersion: 1
  familyId: string
  revision: number
  title: string
  tags: string[]
  aspects: ('9:16' | '16:9' | '1:1')[]
  fps: 30
  totalFrames: number
  slots: TemplateSlot[]
  texts: TemplateText[]
  graphics?: TemplateGraphic[]
  beatAnchors: number[]
  phraseAnchors?: TemplatePhraseAnchor[]
  /** Batch 7 declarative standalone graphics/composite primitives. */
  primitives?: Batch7TemplatePrimitive[]
}
export type TemplateDesignV1 = {
  schemaVersion: 1
  designId: string
  revision: number
  stylePackId: string
  familyId: string
  familyRevision: number
  musicPolicy: 'none' | 'licensed-only'
}
export type TemplateChoices = {
  instanceId: string
  media: Record<string, TemplateAsset>
  texts?: Record<string, string>
  music?: TemplateAsset
  /** Selected template preview/render aspect. Defaults to the family's first authored aspect. */
  aspect?: '9:16' | '16:9' | '1:1'
  accessibility?: { reducedMotion?: boolean; reducedFlash?: boolean }
}
export type TemplateSequenceItem = {
  id: string
  slotId: string
  assetId: string
  outputStartFrame: number
  outputEndFrame: number
  mediaInFrame: number
  fit: 'cover' | 'contain'
  sourceAudio: 'mute' | 'source'
  speed?: number
  playback?: SourceSegmentPlayback
  transition: 'cut' | TemplateTransition
  motion?: TemplateMotion
  transform?: SourceSegmentTransform
  fx?: SourceSegmentFx
}
export type TemplateSequenceV1 = {
  v: 1
  fps: 30
  totalFrames: number
  items: TemplateSequenceItem[]
  provenance: {
    instanceId: string
    familyId: string
    familyRevision: number
    designId: string
    designRevision: number
  }
}
export type TemplateCompileResult = {
  edits: ClipEditsV2
  sequence: TemplateSequenceV1
  slotToItemIds: Record<string, string>
  warnings: string[]
  renderable: true
}

const ID = /^[A-Za-z0-9_-]{1,80}$/
const COLOR = /^#[0-9a-fA-F]{6}$/
const MAX_FRAMES = 30 * 60 * 30
const MAX_SLOTS = 120
const MAX_TEXTS = 60
const MAX_GRAPHICS = 60
/** B6 launch-safe cross-source set. Hard cut is represented by the literal "cut". */
export const TEMPLATE_TRANSITION_TYPES = [
  'crossfade', 'dip_white',
  'push_left', 'push_right', 'push_up', 'push_down',
  'wipe_left', 'wipe_right', 'wipe_up', 'wipe_down',
  'zoom_blur', 'whip_pan', 'glitch',
] as const satisfies readonly TransitionType[]
/** Catalog entries stay visible to callers but cannot be authored until cross-source output is proven. */
export const TEMPLATE_UNAVAILABLE_TRANSITION_TYPES = TRANSITION_TYPES.filter(
  (type) => !(TEMPLATE_TRANSITION_TYPES as readonly TransitionType[]).includes(type),
)
const GRAPHICS = new Set(['rect','rounded','circle','triangle','star','heart','arrow'])
const own = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const exact = (o: Record<string, unknown>, keys: readonly string[], context: string) => {
  for (const k of Object.keys(o)) if (!keys.includes(k)) throw new Error(`${context}: unsupported field "${k}"`)
}
const id = (v: unknown, context: string) => {
  if (typeof v !== 'string' || !ID.test(v)) throw new Error(`${context}: invalid trusted ID`)
  return v
}
const integer = (v: unknown, lo: number, hi: number, context: string) => {
  if (!Number.isInteger(v) || (v as number) < lo || (v as number) > hi)
    throw new Error(`${context}: expected integer ${lo}..${hi}`)
  return v as number
}
const finite = (v: unknown, lo: number, hi: number, context: string) => {
  const n = Number(v)
  if (!Number.isFinite(n) || n < lo || n > hi) throw new Error(`${context}: expected number ${lo}..${hi}`)
  return n
}
const oneOf = <T extends string>(v: unknown, values: readonly T[], context: string): T => {
  if (!values.includes(v as T)) throw new Error(`${context}: unsupported capability ${String(v)}`)
  return v as T
}
const unique = (v: string, set: Set<string>, context: string) => {
  if (set.has(v)) throw new Error(`${context}: duplicate ID ${v}`)
  set.add(v)
}
function validateTransform(raw: unknown): SourceSegmentTransform | undefined {
  if (raw == null) return undefined
  if (!own(raw)) throw new Error('slot.transform: expected object')
  exact(raw, ['x','y','scale','rotation','cropL','cropT','cropR','cropB'], 'slot.transform')
  const out: SourceSegmentTransform = {}
  for (const k of ['x','y'] as const) if (raw[k] != null) out[k] = finite(raw[k], -100, 100, `slot.transform.${k}`)
  if (raw.scale != null) out.scale = finite(raw.scale, 25, 400, 'slot.transform.scale')
  if (raw.rotation != null) out.rotation = finite(raw.rotation, -360, 360, 'slot.transform.rotation')
  for (const k of ['cropL','cropT','cropR','cropB'] as const)
    if (raw[k] != null) out[k] = finite(raw[k], 0, 90, `slot.transform.${k}`)
  if ((out.cropL ?? 0) + (out.cropR ?? 0) > 95 || (out.cropT ?? 0) + (out.cropB ?? 0) > 95)
    throw new Error('slot.transform: crop must leave at least 5% visible')
  return Object.keys(out).length ? out : undefined
}
function validateFx(raw: unknown): SourceSegmentFx | undefined {
  if (raw == null) return undefined
  if (!own(raw)) throw new Error('slot.fx: expected object')
  exact(raw, ['brightness','contrast','saturation'], 'slot.fx')
  const out: SourceSegmentFx = {}
  for (const k of ['brightness','contrast','saturation'] as const)
    if (raw[k] != null) out[k] = finite(raw[k], -100, 100, `slot.fx.${k}`)
  return Object.keys(out).length ? out : undefined
}
function validateMotionState(raw: unknown, context: string): TemplateMotionState | undefined {
  if (raw == null) return undefined
  if (!own(raw)) throw new Error(`${context}: expected object`)
  exact(raw, ['x','y','scale','rotation'], context)
  const out: TemplateMotionState = {}
  if (raw.x != null) out.x = finite(raw.x, -100, 100, context + '.x')
  if (raw.y != null) out.y = finite(raw.y, -100, 100, context + '.y')
  if (raw.scale != null) out.scale = finite(raw.scale, 25, 400, context + '.scale')
  if (raw.rotation != null) out.rotation = finite(raw.rotation, -360, 360, context + '.rotation')
  return Object.keys(out).length ? out : undefined
}
/** Strict authored animation: no silently clamped timing, unknown effects or arbitrary commands. */
function validateAuthoredAnim(raw: unknown, context: string, graphic = false): TextAnim | undefined {
  if (raw == null) return undefined
  if (!own(raw)) throw new Error(`${context}.anim: expected object`)
  exact(raw, ['in', 'out', 'loop'], `${context}.anim`)
  const out: TextAnim = {}
  for (const edge of ['in','out'] as const) {
    const value = raw[edge]
    if (value == null) continue
    if (!own(value)) throw new Error(`${context}.anim.${edge}: expected object`)
    exact(value, ['type', 'unit', 'durMs'], `${context}.anim.${edge}`)
    const type = oneOf(value.type, TEXT_ANIM_IN_TYPES, `${context}.anim.${edge}.type`)
    const unit = oneOf(value.unit, TEXT_ANIM_UNITS, `${context}.anim.${edge}.unit`)
    if (graphic && (unit !== 'block' || TEXT_ONLY_ANIM.has(type)))
      throw new Error(`${context}.anim: graphics require whole-layer motion`)
    if ((TEXT_ANIM_BLOCK_ONLY as readonly string[]).includes(type) && unit !== 'block')
      throw new Error(`${context}.anim: motion type requires block unit`)
    if (type === 'typewriter' && unit === 'block')
      throw new Error(`${context}.anim: typewriter requires a text unit`)
    out[edge] = { type, unit, durMs: integer(value.durMs, 100, 5000, `${context}.anim.${edge}.durMs`) }
  }
  const loop = raw.loop
  if (loop != null) {
    if (!own(loop)) throw new Error(`${context}.anim.loop: expected object`)
    exact(loop, ['type','periodMs'], `${context}.anim.loop`)
    out.loop = {
      type: oneOf(loop.type, TEXT_ANIM_LOOP_TYPES, `${context}.anim.loop.type`),
      periodMs: integer(loop.periodMs, 300, 4000, `${context}.anim.loop.periodMs`),
    }
  }
  if (!Object.keys(out).length) throw new Error(`${context}.anim: no animation specified`)
  return out
}

function validateMotion(raw: unknown): TemplateMotion | undefined {
  if (raw == null) return undefined
  if (!own(raw)) throw new Error('slot.motion: expected object')
  exact(raw, ['from','to','ease'], 'slot.motion')
  const from = validateMotionState(raw.from, 'slot.motion.from')
  const to = validateMotionState(raw.to, 'slot.motion.to')
  if (!to) throw new Error('slot.motion: to state requires at least one property')
  const ease = raw.ease == null ? undefined : oneOf(raw.ease, ['linear','in','out','inOut'] as const, 'slot.motion.ease')
  return { ...(from ? { from } : {}), to, ...(ease && ease !== 'linear' ? { ease } : {}) }
}

function validateTransition(raw: unknown, index: number): 'cut' | TemplateTransition {
  if (raw === 'cut') return 'cut'
  if (!own(raw)) throw new Error('slot.transition: unsupported capability')
  exact(raw, ['type','durationFrames'], 'slot.transition')
  if (index === 0) throw new Error('slot.transition: first slot must be cut')
  const type = oneOf(raw.type, TEMPLATE_TRANSITION_TYPES, 'slot.transition.type')
  return { type, durationFrames: integer(raw.durationFrames, 3, 60, 'slot.transition.durationFrames') }
}

export function validateTemplateFamily(raw: unknown): TemplateFamilyV1 {
  if (!own(raw)) throw new Error('family: expected JSON object')
  exact(raw, ['schemaVersion','familyId','revision','title','tags','aspects','fps','totalFrames','slots','texts','graphics','beatAnchors','phraseAnchors','primitives'], 'family')
  if (raw.schemaVersion !== 1 || raw.fps !== 30) throw new Error('family: unsupported schema/fps')
  id(raw.familyId, 'family')
  integer(raw.revision, 1, 1_000_000, 'family revision')
  if (typeof raw.title !== 'string' || !raw.title.trim() || raw.title.length > 120) throw new Error('family: invalid title')
  if (!Array.isArray(raw.tags) || raw.tags.length > 20 || raw.tags.some(x => typeof x !== 'string' || !ID.test(x))) throw new Error('family: invalid tags')
  if (!Array.isArray(raw.aspects) || !raw.aspects.length || raw.aspects.length > 3) throw new Error('family: invalid aspects')
  for (const x of raw.aspects) oneOf(x, ['9:16','16:9','1:1'] as const, 'aspect')
  const total = integer(raw.totalFrames, 1, MAX_FRAMES, 'totalFrames')
  if (!Array.isArray(raw.slots) || !raw.slots.length || raw.slots.length > MAX_SLOTS) throw new Error('family: slot budget exceeded')
  const rawSlots = raw.slots
  const seen = new Set<string>()
  let cursor = 0
  const slots: TemplateSlot[] = rawSlots.map((value: unknown, index: number) => {
    if (!own(value)) throw new Error('slot: expected object')
    exact(value, ['id','ordinal','role','media','startFrame','durationFrames','sourceInFrame','handles','fit','sourceAudio','speed','playback','transition','motion','transform','fx'], 'slot')
    const sid = id(value.id, 'slot')
    unique(sid, seen, 'slot')
    if (integer(value.ordinal, 1, MAX_SLOTS, 'ordinal') !== index + 1) throw new Error('slot: ordinals must be sequential')
    const startFrame = integer(value.startFrame, 0, total - 1, 'startFrame')
    if (startFrame !== cursor) throw new Error('slot: gap/overlap in output sequence')
    const durationFrames = integer(value.durationFrames, 3, total, 'durationFrames')
    cursor += durationFrames
    if (cursor > total) throw new Error('slot: exceeds totalFrames')
    const media = oneOf(value.media, ['image','video','either'] as const, 'media')
    const sourceAudio = oneOf(value.sourceAudio, ['mute','source'] as const, 'sourceAudio')
    if (media === 'image' && sourceAudio === 'source') throw new Error('slot: image cannot have source audio')
    let handles: TemplateSlot['handles']
    if (value.handles != null) {
      if (!own(value.handles)) throw new Error('slot.handles: expected object')
      exact(value.handles, ['headFrames','tailFrames'], 'slot.handles')
      handles = {
        headFrames: integer(value.handles.headFrames, 0, MAX_FRAMES, 'slot.handles.headFrames'),
        tailFrames: integer(value.handles.tailFrames, 0, MAX_FRAMES, 'slot.handles.tailFrames'),
      }
    }
    const rawSpeed = value.speed == null ? undefined : finite(value.speed, 0.25, 4, 'slot.speed')
    const speed = rawSpeed == null ? undefined : Math.round(rawSpeed * 1000) / 1000
    if (rawSpeed != null && Math.abs(rawSpeed - speed!) > 1e-9)
      throw new Error('slot.speed: maximum precision is 3 decimals')
    const playback = value.playback == null ? undefined : validateTemplatePlaybackSpec(value.playback, durationFrames)
    if (speed != null && playback) throw new Error('slot: speed and playback are mutually exclusive')
    if (media === 'image' && ((speed != null && Math.abs(speed - 1) >= 0.0001) || playback))
      throw new Error('slot.speed: images do not support playback speed')
    const transition = validateTransition(value.transition, index)
    if (transition !== 'cut' && transition.durationFrames > Math.min(durationFrames, index ? integer((rawSlots[index - 1] as Record<string, unknown>).durationFrames, 3, total, 'previous.durationFrames') : durationFrames))
      throw new Error('slot.transition: longer than adjacent slot')
    return {
      id: sid,
      ordinal: index + 1,
      role: oneOf(value.role, ['hero','support','detail','closing'] as const, 'role'),
      media, startFrame, durationFrames,
      ...(value.sourceInFrame != null ? { sourceInFrame: integer(value.sourceInFrame, 0, MAX_FRAMES, 'sourceInFrame') } : {}),
      ...(handles ? { handles } : {}),
      fit: oneOf(value.fit, ['cover','contain'] as const, 'fit'),
      sourceAudio,
      ...(speed != null && Math.abs(speed - 1) >= 0.0001 ? { speed } : {}),
      ...(playback ? { playback } : {}),
      transition,
      ...(validateMotion(value.motion) ? { motion: validateMotion(value.motion) } : {}),
      ...(validateTransform(value.transform) ? { transform: validateTransform(value.transform) } : {}),
      ...(validateFx(value.fx) ? { fx: validateFx(value.fx) } : {}),
    }
  })
  if (cursor !== total) throw new Error(`family: slots cover ${cursor}/${total} frames`)
  // A/B handles are structural requirements, not best-effort render hints. A transition consumes
  // half its duration from each adjacent source; adjacent transition halves may not overlap.
  for (let i = 1; i < slots.length; i++) {
    const incoming = slots[i]!.transition
    if (incoming === 'cut') continue
    const need = Math.ceil(incoming.durationFrames / 2)
    const leftPlan = slots[i - 1]!.playback
      ? compileTemplatePlayback(slots[i - 1]!.playback, slots[i - 1]!.durationFrames)
      : undefined
    const rightPlan = slots[i]!.playback
      ? compileTemplatePlayback(slots[i]!.playback, slots[i]!.durationFrames)
      : undefined
    const leftNeed = leftPlan
      ? playbackRequiredHandleFrames(leftPlan, 'tail', need)
      : Math.ceil(need * (slots[i - 1]!.speed ?? 1))
    const rightNeed = rightPlan
      ? playbackRequiredHandleFrames(rightPlan, 'head', need)
      : Math.ceil(need * (slots[i]!.speed ?? 1))
    if ((slots[i - 1]!.handles?.tailFrames ?? 0) < leftNeed ||
        (slots[i]!.handles?.headFrames ?? 0) < rightNeed)
      throw new Error(`slot.transition: ${slots[i]!.id} requires source handles (left ${leftNeed}, right ${rightNeed} frames)`)
  }
  for (let i = 0; i < slots.length; i++) {
    const incomingHalf = i > 0 && slots[i]!.transition !== 'cut'
      ? Math.ceil((slots[i]!.transition as TemplateTransition).durationFrames / 2)
      : 0
    const outgoingHalf = i + 1 < slots.length && slots[i + 1]!.transition !== 'cut'
      ? Math.ceil((slots[i + 1]!.transition as TemplateTransition).durationFrames / 2)
      : 0
    if (incomingHalf + outgoingHalf > slots[i]!.durationFrames)
      throw new Error(`slot.transition: transition windows overlap inside ${slots[i]!.id}`)
  }

  if (!Array.isArray(raw.texts) || raw.texts.length > MAX_TEXTS) throw new Error('family: text budget exceeded')
  const textIds = new Set<string>()
  const texts: TemplateText[] = raw.texts.map((value: unknown) => {
    if (!own(value)) throw new Error('text: expected object')
    exact(value, ['id','defaultText','maxChars','startFrame','durationFrames','x','y','font','size','color','anim'], 'text')
    const tid = id(value.id, 'text'); unique(tid, textIds, 'text')
    const maxChars = integer(value.maxChars, 1, 200, 'text.maxChars')
    if (typeof value.defaultText !== 'string' || !value.defaultText.trim() || Array.from(value.defaultText).length > maxChars) throw new Error('text: invalid default')
    const startFrame = integer(value.startFrame, 0, total - 1, 'text.startFrame')
    const durationFrames = integer(value.durationFrames, 9, total, 'text.durationFrames')
    if (startFrame + durationFrames > total) throw new Error('text: out of bounds')
    const color = String(value.color ?? '')
    if (!COLOR.test(color)) throw new Error('text: invalid color')
    return {
      id: tid, defaultText: value.defaultText, maxChars, startFrame, durationFrames,
      x: finite(value.x, 0, 100, 'text.x'), y: finite(value.y, 0, 100, 'text.y'),
      font: oneOf(value.font, ['Montserrat','Anton','Poppins'] as const, 'font'),
      size: integer(value.size, 24, 240, 'text.size'), color,
      ...(validateAuthoredAnim(value.anim, 'text') ? { anim: validateAuthoredAnim(value.anim, 'text') } : {}),
    }
  })

  let graphics: TemplateGraphic[] | undefined
  if (raw.graphics != null) {
    if (!Array.isArray(raw.graphics) || raw.graphics.length > MAX_GRAPHICS) throw new Error('family: graphic budget exceeded')
    const ids = new Set<string>()
    graphics = raw.graphics.map((value: unknown) => {
      if (!own(value)) throw new Error('graphic: expected object')
      exact(value, ['id','type','startFrame','durationFrames','x','y','w','h','color','anim'], 'graphic')
      const gid = id(value.id, 'graphic'); unique(gid, ids, 'graphic')
      if (!GRAPHICS.has(String(value.type))) throw new Error('graphic: unsupported type')
      const startFrame = integer(value.startFrame, 0, total - 1, 'graphic.startFrame')
      const durationFrames = integer(value.durationFrames, 9, total, 'graphic.durationFrames')
      if (startFrame + durationFrames > total) throw new Error('graphic: out of bounds')
      const color = String(value.color ?? ''); if (!COLOR.test(color)) throw new Error('graphic: invalid color')
      return {
        id: gid, type: value.type as TemplateGraphic['type'], startFrame, durationFrames,
        x: finite(value.x, 0, 100, 'graphic.x'), y: finite(value.y, 0, 100, 'graphic.y'),
        w: integer(value.w, 8, 1920, 'graphic.w'), h: integer(value.h, 8, 1920, 'graphic.h'), color,
        ...(validateAuthoredAnim(value.anim, 'graphic', true) ? { anim: validateAuthoredAnim(value.anim, 'graphic', true) } : {}),
      }
    })
  }
  if (texts.length + (graphics?.length ?? 0) > MAX_TEXTS)
    throw new Error('family: combined text/graphic budget exceeds editor capacity')
  if (!Array.isArray(raw.beatAnchors) || raw.beatAnchors.length > 500) throw new Error('family: beat budget exceeded')
  const beatAnchors = raw.beatAnchors.map(n => integer(n, 0, total - 1, 'beat'))
  let phraseAnchors: TemplatePhraseAnchor[] | undefined
  if (raw.phraseAnchors != null) {
    if (!Array.isArray(raw.phraseAnchors) || raw.phraseAnchors.length > 500) throw new Error('family: phrase anchor budget exceeded')
    const ids = new Set<string>()
    phraseAnchors = raw.phraseAnchors.map((value: unknown) => {
      if (!own(value)) throw new Error('phraseAnchor: expected object')
      exact(value, ['id','frame','textFieldId'], 'phraseAnchor')
      const pid = id(value.id, 'phraseAnchor'); unique(pid, ids, 'phraseAnchor')
      const textFieldId = value.textFieldId == null ? undefined : id(value.textFieldId, 'phraseAnchor.textFieldId')
      if (textFieldId && !textIds.has(textFieldId)) throw new Error('phraseAnchor: unknown text field')
      return { id: pid, frame: integer(value.frame, 0, total - 1, 'phraseAnchor.frame'), ...(textFieldId ? { textFieldId } : {}) }
    })
  }
  const primitives = raw.primitives == null ? undefined : validateBatch7Primitives(raw.primitives, total, new Set(slots.map((slot) => slot.id)))
  return {
    schemaVersion: 1, familyId: raw.familyId as string, revision: raw.revision as number,
    title: raw.title.trim(), tags: [...raw.tags] as string[], aspects: [...raw.aspects] as TemplateFamilyV1['aspects'],
    fps: 30, totalFrames: total, slots, texts, ...(graphics?.length ? { graphics } : {}),
    beatAnchors, ...(phraseAnchors?.length ? { phraseAnchors } : {}),
    ...(primitives?.length ? { primitives } : {}),
  }
}
export function validateTemplateDesign(raw: unknown, family: TemplateFamilyV1): TemplateDesignV1 {
  if (!own(raw)) throw new Error('design: expected object')
  exact(raw, ['schemaVersion','designId','revision','stylePackId','familyId','familyRevision','musicPolicy'], 'design')
  if (raw.schemaVersion !== 1) throw new Error('design: unsupported version')
  const designId = id(raw.designId, 'design'), stylePackId = id(raw.stylePackId, 'stylePack')
  const revision = integer(raw.revision, 1, 1_000_000, 'design revision')
  if (raw.familyId !== family.familyId || raw.familyRevision !== family.revision) throw new Error('design: family revision mismatch')
  return { schemaVersion: 1, designId, revision, stylePackId, familyId: family.familyId, familyRevision: family.revision,
    musicPolicy: oneOf(raw.musicPolicy, ['none','licensed-only'] as const, 'music') }
}
function validateAsset(asset: unknown, kind: TemplateAsset['kind'][], context: string): TemplateAsset {
  if (!own(asset)) throw new Error(`${context}: missing registered asset`)
  exact(asset, ['id','kind','license','durationFrames'], context)
  const aid = id(asset.id, context)
  const ak = oneOf(asset.kind, kind, context)
  if (!own(asset.license)) throw new Error(`${context}: missing license provenance`)
  exact(asset.license, ['id','provenance','reference'], 'license')
  const license = {
    id: id(asset.license.id, 'license'),
    provenance: oneOf(asset.license.provenance, ['user-owned','first-party','licensed'] as const, 'license provenance'),
    reference: id(asset.license.reference, 'license reference'),
  }
  const durationFrames = ak === 'image' ? undefined : integer(asset.durationFrames, 1, MAX_FRAMES, `${context}.durationFrames`)
  return { id: aid, kind: ak, license, ...(durationFrames ? { durationFrames } : {}) }
}
/** Stable IDs derived only from immutable instance/family revision + semantic role. */
export function templateSeededId(...parts: string[]) {
  const s = parts.map(x => `${x.length}:${x}`).join('|')
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return `tv_${(h >>> 0).toString(36)}`
}
export const templateFrameToMs = (frame: number) => Math.round(frame * 1000 / 30)

export function compileTemplate(
  rawFamily: unknown, rawDesign: unknown, choices: TemplateChoices,
  carrier: { durationFrames: number; edits: ClipEditsV2 },
): TemplateCompileResult {
  const family = validateTemplateFamily(rawFamily)
  const design = validateTemplateDesign(rawDesign, family)
  id(choices?.instanceId, 'instance')
  const selectedAspect = choices.aspect ?? family.aspects[0]!
  if (!family.aspects.includes(selectedAspect)) throw new Error('instance: selected aspect not authored by family')
  if (carrier.durationFrames !== family.totalFrames) throw new Error('carrier: exact frame count required')
  if (carrier.edits.inserts?.length) throw new Error('carrier: post-composite inserts not permitted')
  if (!choices?.media || typeof choices.media !== 'object' || Array.isArray(choices.media)) throw new Error('instance: media assignments required')
  const allowed = new Set(family.slots.map(s => s.id))
  for (const k of Object.keys(choices.media)) if (!allowed.has(k)) throw new Error(`unknown media choice: ${k}`)
  if (Object.keys(choices.media).length !== family.slots.length) throw new Error('instance: every slot requires media')
  const textKeys = new Set(family.texts.map(t => t.id))
  for (const k of Object.keys(choices.texts ?? {})) if (!textKeys.has(k)) throw new Error(`unknown text choice: ${k}`)

  const sources: NonNullable<ClipEditsV2['sources']> = []
  const sourceIds = new Map<string, string>()
  const sourceSegments: NonNullable<ClipEditsV2['sourceSegments']> = []
  const sequence: TemplateSequenceItem[] = []
  const slotToItemIds: Record<string, string> = {}
  const slotToSourceIds: Record<string, string> = {}
  const slotToMediaKind: Record<string, 'image' | 'video'> = {}
  const slotWindows: Record<string, { startFrame: number; durationFrames: number }> = {}
  const transitions: NonNullable<ClipEditsV2['transitions']> = []
  const videoSplits: number[] = []
  const reducedMotion = choices.accessibility?.reducedMotion === true
  const reducedFlash = choices.accessibility?.reducedFlash === true

  for (const [index, slot] of family.slots.entries()) {
    const asset = validateAsset(choices.media[slot.id], slot.media === 'either' ? ['image','video'] : [slot.media], slot.id)
    const inFrame = slot.sourceInFrame ?? 0
    const head = slot.handles?.headFrames ?? 0, tail = slot.handles?.tailFrames ?? 0
    const playback = slot.playback ? compileTemplatePlayback(slot.playback, slot.durationFrames) : undefined
    if (asset.kind === 'video') {
      if (playback) {
        const bounds = playbackSourceBounds(playback, inFrame)
        if (inFrame < head || bounds.minFrame < 0 || bounds.maxFrame + tail >= (asset.durationFrames ?? 0))
          throw new Error(`slot ${slot.ordinal} (${slot.id}): video too short for required handles/playback; choose a longer clip or reduce the ramp/hold handles`)
      } else {
        const rate = slot.speed ?? 1
        const visibleSourceFrames = Math.ceil(slot.durationFrames * rate)
        if (inFrame < head || inFrame + visibleSourceFrames + tail > (asset.durationFrames ?? 0))
          throw new Error(`slot ${slot.ordinal} (${slot.id}): video too short for required handles/speed; choose a longer clip, reduce speed, or shorten the slot`)
      }
    } else if ((slot.speed != null && Math.abs(slot.speed - 1) >= 0.0001) || playback) {
      throw new Error(`slot ${slot.id}: playback speed requires video media`)
    }
    if (slot.sourceAudio === 'source' && asset.kind !== 'video') throw new Error(`slot ${slot.id}: missing video audio`)
    const key = `${asset.kind}:${asset.id}`
    let sourceId = sourceIds.get(key)
    if (!sourceId) {
      sourceId = templateSeededId(choices.instanceId, family.familyId, String(family.revision), 'source', asset.id)
      sourceIds.set(key, sourceId)
      sources.push({ id: sourceId, ref: 'upload', refId: asset.id, mediaType: asset.kind,
        ...(asset.durationFrames ? { durationMs: templateFrameToMs(asset.durationFrames) } : {}) })
    }
    if (sources.length > 50) throw new Error('sequence: source registry exceeds supported budget')
    const itemId = templateSeededId(choices.instanceId, family.familyId, String(family.revision), 'slot', slot.id)
    slotToItemIds[slot.id] = itemId
    slotToSourceIds[slot.id] = sourceId
    if (asset.kind === 'audio') throw new Error('slot ' + slot.id + ': audio-only media is unsupported')
    slotToMediaKind[slot.id] = asset.kind
    slotWindows[slot.id] = { startFrame: slot.startFrame, durationFrames: slot.durationFrames }
    const startMs = templateFrameToMs(slot.startFrame), endMs = templateFrameToMs(slot.startFrame + slot.durationFrames)
    sourceSegments.push({
      id: itemId, sourceId, startMs, endMs,
      ...(asset.kind === 'video' ? { inMs: templateFrameToMs(inFrame), audio: slot.sourceAudio === 'source' ? 'source' as const : 'main' as const } : {}),
      fit: slot.fit,
      ...(slot.speed ? { speed: slot.speed } : {}),
      ...(playback ? { playback } : {}),
      ...(slot.transform ? { transform: slot.transform } : {}),
      ...(slot.fx ? { fx: slot.fx } : {}),
    })
    const effectiveTransition: 'cut' | TemplateTransition = slot.transition === 'cut'
      ? 'cut'
      : reducedMotion
        ? 'cut'
        : reducedFlash && slot.transition.type === 'dip_white'
          ? { ...slot.transition, type: 'crossfade' }
          : slot.transition
    if (index > 0) {
      videoSplits.push(startMs)
      if (effectiveTransition !== 'cut') transitions.push({
        srcMs: startMs, type: effectiveTransition.type, durMs: templateFrameToMs(effectiveTransition.durationFrames),
      })
    }
    sequence.push({
      id: itemId, slotId: slot.id, assetId: asset.id,
      outputStartFrame: slot.startFrame, outputEndFrame: slot.startFrame + slot.durationFrames,
      mediaInFrame: inFrame, fit: slot.fit, sourceAudio: slot.sourceAudio, ...(slot.speed ? { speed: slot.speed } : {}), transition: effectiveTransition,
      ...(playback ? { playback } : {}),
      ...(!reducedMotion && slot.motion ? { motion: slot.motion } : {}),
      ...(slot.transform ? { transform: slot.transform } : {}),
      ...(slot.fx ? { fx: slot.fx } : {}),
    })
  }

  const motionKeyframes: NonNullable<ClipEditsV2['keyframes']> = []
  if (!reducedMotion && family.slots.some((slot) => slot.motion)) {
    const defaults = { x: 0, y: 0, scale: 100, rotation: 0 } as const
    for (const prop of ['x','y','scale','rotation'] as const) {
      const points: NonNullable<ClipEditsV2['keyframes']>[number]['points'] = []
      let used = false
      for (const slot of family.slots) {
        const startMs = templateFrameToMs(slot.startFrame)
        const endMs = templateFrameToMs(slot.startFrame + slot.durationFrames - 1)
        const from = slot.motion?.from?.[prop] ?? defaults[prop]
        const to = slot.motion?.to?.[prop] ?? (slot.motion ? from : defaults[prop])
        if (from !== defaults[prop] || to !== defaults[prop]) used = true
        points.push({
          tMs: startMs,
          v: from,
          ...(slot.motion?.ease ? { ease: slot.motion.ease } : {}),
        })
        if (endMs > startMs) points.push({ tMs: endMs, v: to })
      }
      if (used) motionKeyframes.push({ target: 'video', prop, points })
    }
  }

  const textItems: NonNullable<ClipEditsV2['textItems']> = family.texts.map(t => {
    const text = choices.texts?.[t.id] ?? t.defaultText
    if (typeof text !== 'string' || !text.trim() || Array.from(text).length > t.maxChars) throw new Error(`text ${t.id}: limit ${t.maxChars} characters`)
    return {
      id: templateSeededId(choices.instanceId, family.familyId, String(family.revision), 'text', t.id),
      text, startMs: templateFrameToMs(t.startFrame), endMs: templateFrameToMs(t.startFrame + t.durationFrames),
      x: t.x, y: t.y, style: { font: t.font, size: t.size, color: t.color, align: 'center' as const, case: 'none' as const },
      ...(t.anim ? { anim: t.anim } : {}),
    }
  })
  for (const g of family.graphics ?? []) textItems.push({
    id: templateSeededId(choices.instanceId, family.familyId, String(family.revision), 'graphic', g.id),
    text: '', kind: 'shape', shape: { type: g.type, w: g.w, h: g.h },
    startMs: templateFrameToMs(g.startFrame), endMs: templateFrameToMs(g.startFrame + g.durationFrames),
    x: g.x, y: g.y, style: { font: 'Montserrat', size: 24, color: g.color, align: 'center', case: 'none' },
    ...(g.anim ? { anim: g.anim } : {}),
  })

  let music = null
  if (choices.music) {
    if (design.musicPolicy === 'none') throw new Error('design: music forbidden')
    const asset = validateAsset(choices.music, ['audio'], 'music')
    music = { generationId: asset.id, uploadId: asset.id, startMs: 0,
      endMs: templateFrameToMs(family.totalFrames), loop: true }
  }

  const motionTrackKeys = new Set(motionKeyframes.map((track) => track.target + '|' + track.prop))
  const preservedKeyframes = (carrier.edits.keyframes ?? []).filter((track) => !motionTrackKeys.has(track.target + '|' + track.prop))
  const mergedKeyframes = [...preservedKeyframes, ...motionKeyframes]
  const mergedTextItems = [...(carrier.edits.textItems ?? []), ...textItems]
  if (mergedTextItems.length > MAX_TEXTS)
    throw new Error('template: textItems capacity exceeded before primitive compilation')

  const baseEdits: ClipEditsV2 = {
    ...structuredClone(carrier.edits),
    sources, sourceSegments, videoSplits: videoSplits.length ? videoSplits : undefined,
    transitions: transitions.length ? transitions : undefined,
    keyframes: mergedKeyframes.length ? mergedKeyframes : undefined,
    textItems: mergedTextItems.length ? mergedTextItems : undefined,
    audio: { music, sfx: [] },
    captions: { ...carrier.edits.captions, enabled: false },
    trim: { in: 0, out: templateFrameToMs(family.totalFrames) },
    cutRanges: [],
    templateProvenance: { v: 1, instanceId: choices.instanceId, familyId: family.familyId, familyRevision: family.revision,
      designId: design.designId, designRevision: design.revision, slotToItemIds },
  }
  const primitiveResult = family.primitives?.length
    ? compileBatch7Primitives(baseEdits, family.primitives, {
        format: selectedAspect, totalFrames: family.totalFrames, slotToItemIds, slotToSourceIds, slotToMediaKind, slotWindows,
      }, choices.accessibility)
    : { ok: true as const, edits: baseEdits, addedIds: [] as string[] }
  if (!primitiveResult.ok) throw new Error('template primitives: ' + primitiveResult.code + ': ' + primitiveResult.detail)
  const edits = primitiveResult.edits
  return {
    edits,
    sequence: { v: 1, fps: 30, totalFrames: family.totalFrames, items: sequence,
      provenance: { instanceId: choices.instanceId, familyId: family.familyId, familyRevision: family.revision,
        designId: design.designId, designRevision: design.revision } },
    slotToItemIds,
    warnings: [],
    renderable: true,
  }
}

/** Backward-compatible name retained for the earlier B3 fixtures. */
export const compileTemplatePrototype = compileTemplate
