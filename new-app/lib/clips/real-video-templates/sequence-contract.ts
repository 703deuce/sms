/**
 * B3 experimental DATA-only video-template contract.
 * NOT a production render adapter. Current E5 sourceSegments replace MAIN SOURCE clock,
 * and E5b inserts are post-composite; neither supports cross-source dissolves.
 * Callers must not persist/offer compiled edits until a versioned preview/export adapter
 * has passed the real FFmpeg integration gate.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'

export type TemplateAsset = {
  id: string
  kind: 'image' | 'video' | 'audio'
  license: { id: string; provenance: 'user-owned' | 'first-party' | 'licensed'; reference: string }
  durationFrames?: number
}
export type TemplateSlot = {
  id: string
  ordinal: number
  role: 'hero' | 'support' | 'detail' | 'closing'
  media: 'image' | 'video' | 'either'
  startFrame: number
  durationFrames: number
  sourceInFrame?: number
  fit: 'cover' | 'contain'
  sourceAudio: 'mute' | 'source'
  transition: 'cut' // dissolve must be implemented by a proven versioned sequence adapter
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
}
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
  beatAnchors: number[]
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
}
export type TemplateSequenceV1 = {
  v: 1
  fps: 30
  totalFrames: number
  items: TemplateSequenceItem[]
  /** Never interpreted as a URL, command, or render expression. */
  provenance: { instanceId: string; familyId: string; familyRevision: number; designId: string; designRevision: number }
}
export type TemplateCompileResult = {
  edits: ClipEditsV2
  sequence: TemplateSequenceV1
  slotToItemIds: Record<string, string>
  warnings: string[]
  /** MUST remain false until both preview and worker understand the same opt-in sequence version. */
  renderable: false
}
const ID = /^[A-Za-z0-9_-]{1,80}$/
const COLOR = /^#[0-9a-fA-F]{6}$/
const MAX_FRAMES = 30 * 60 * 30
const MAX_SLOTS = 120
const MAX_TEXTS = 60
const own = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
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
const oneOf = <T extends string>(v: unknown, values: readonly T[], context: string): T => {
  if (!values.includes(v as T)) throw new Error(`${context}: unsupported capability ${String(v)}`)
  return v as T
}
const unique = (v: string, set: Set<string>, context: string) => {
  if (set.has(v)) throw new Error(`${context}: duplicate ID ${v}`)
  set.add(v)
}
export function validateTemplateFamily(raw: unknown): TemplateFamilyV1 {
  if (!own(raw)) throw new Error('family: expected JSON object')
  exact(raw, ['schemaVersion','familyId','revision','title','tags','aspects','fps','totalFrames','slots','texts','beatAnchors'], 'family')
  if (raw.schemaVersion !== 1 || raw.fps !== 30) throw new Error('family: unsupported schema/fps')
  id(raw.familyId, 'family')
  integer(raw.revision, 1, 1000000, 'family revision')
  if (typeof raw.title !== 'string' || !raw.title.trim() || raw.title.length > 120) throw new Error('family: invalid title')
  if (!Array.isArray(raw.tags) || raw.tags.length > 20 || raw.tags.some(x => typeof x !== 'string' || !ID.test(x))) throw new Error('family: invalid tags')
  if (!Array.isArray(raw.aspects) || !raw.aspects.length || raw.aspects.length > 3) throw new Error('family: invalid aspects')
  for (const x of raw.aspects) oneOf(x, ['9:16','16:9','1:1'] as const, 'aspect')
  const total = integer(raw.totalFrames, 1, MAX_FRAMES, 'totalFrames')
  if (!Array.isArray(raw.slots) || !raw.slots.length || raw.slots.length > MAX_SLOTS) throw new Error('family: slot budget exceeded')
  const seen = new Set<string>()
  let cursor = 0
  raw.slots.forEach((s: unknown, index: number) => {
    if (!own(s)) throw new Error('slot: expected object')
    exact(s, ['id','ordinal','role','media','startFrame','durationFrames','sourceInFrame','fit','sourceAudio','transition'], 'slot')
    unique(id(s.id, 'slot'), seen, 'slot')
    if (integer(s.ordinal, 1, MAX_SLOTS, 'ordinal') !== index + 1) throw new Error('slot: ordinals must be sequential')
    oneOf(s.role, ['hero','support','detail','closing'] as const, 'role')
    oneOf(s.media, ['image','video','either'] as const, 'media')
    oneOf(s.fit, ['cover','contain'] as const, 'fit')
    oneOf(s.sourceAudio, ['mute','source'] as const, 'sourceAudio')
    oneOf(s.transition, ['cut'] as const, 'transition')
    if (integer(s.startFrame, 0, total - 1, 'startFrame') !== cursor) throw new Error('slot: gap/overlap in output sequence')
    const duration = integer(s.durationFrames, 1, total, 'durationFrames')
    integer(s.sourceInFrame ?? 0, 0, MAX_FRAMES, 'sourceInFrame')
    cursor += duration
    if (cursor > total) throw new Error('slot: exceeds totalFrames')
    if (s.media === 'image' && s.sourceAudio === 'source') throw new Error('slot: image cannot have source audio')
  })
  if (cursor !== total) throw new Error(`family: slots cover ${cursor}/${total} frames`)
  if (!Array.isArray(raw.texts) || raw.texts.length > MAX_TEXTS) throw new Error('family: text budget exceeded')
  const textIds = new Set<string>()
  raw.texts.forEach((t: unknown) => {
    if (!own(t)) throw new Error('text: expected object')
    exact(t, ['id','defaultText','maxChars','startFrame','durationFrames','x','y','font','size','color'], 'text')
    unique(id(t.id, 'text'), textIds, 'text')
    const max = integer(t.maxChars, 1, 200, 'text.maxChars')
    if (typeof t.defaultText !== 'string' || !t.defaultText.trim() || Array.from(t.defaultText).length > max) throw new Error('text: invalid default')
    const a = integer(t.startFrame, 0, total - 1, 'text.startFrame')
    if (a + integer(t.durationFrames, 1, total, 'text.durationFrames') > total) throw new Error('text: out of bounds')
    oneOf(t.font, ['Montserrat','Anton','Poppins'] as const, 'font')
    integer(t.x, 0, 100, 'text.x')
    integer(t.y, 0, 100, 'text.y')
    integer(t.size, 24, 240, 'text.size')
    if (typeof t.color !== 'string' || !COLOR.test(t.color)) throw new Error('text: invalid color')
  })
  if (!Array.isArray(raw.beatAnchors) || raw.beatAnchors.length > 500) throw new Error('family: beat budget exceeded')
  for (const n of raw.beatAnchors) integer(n, 0, total - 1, 'beat')
  return structuredClone(raw) as TemplateFamilyV1
}
export function validateTemplateDesign(raw: unknown, family: TemplateFamilyV1): TemplateDesignV1 {
  if (!own(raw)) throw new Error('design: expected object')
  exact(raw, ['schemaVersion','designId','revision','stylePackId','familyId','familyRevision','musicPolicy'], 'design')
  if (raw.schemaVersion !== 1) throw new Error('design: unsupported version')
  id(raw.designId, 'design')
  id(raw.stylePackId, 'stylePack')
  integer(raw.revision, 1, 1000000, 'design revision')
  if (raw.familyId !== family.familyId || raw.familyRevision !== family.revision) throw new Error('design: family revision mismatch')
  oneOf(raw.musicPolicy, ['none','licensed-only'] as const, 'music')
  return structuredClone(raw) as TemplateDesignV1
}
function validateAsset(asset: unknown, kind: TemplateAsset['kind'][], context: string): TemplateAsset {
  if (!own(asset)) throw new Error(`${context}: missing registered asset`)
  exact(asset, ['id','kind','license','durationFrames'], context)
  id(asset.id, context)
  oneOf(asset.kind, kind, context)
  if (!own(asset.license)) throw new Error(`${context}: missing license provenance`)
  exact(asset.license, ['id','provenance','reference'], 'license')
  id(asset.license.id, 'license')
  oneOf(asset.license.provenance, ['user-owned','first-party','licensed'] as const, 'license provenance')
  id(asset.license.reference, 'license reference')
  if (asset.kind === 'video' || asset.kind === 'audio')
    integer(asset.durationFrames, 1, MAX_FRAMES, `${context}.durationFrames`)
  return structuredClone(asset) as TemplateAsset
}
/** Stable, no random UUID and no runtime-specific crypto implementation. */
function seededId(...parts: string[]) {
  const s = parts.map(x => `${x.length}:${x}`).join('|')
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return `tv_${(h >>> 0).toString(36)}`
}
const ms = (frame: number) => Math.round(frame * 1000 / 30)

/**
 * A deliberately NON-RENDERABLE carrier experiment. Result contains ordinary edits
 * and an independent v1 sequence manifest for parity tests, not a second player.
 * Production MUST reject renderable=false until a shared opt-in preview+worker
 * sequence adapter consumes this representation without post-composite inserts.
 */
export function compileTemplatePrototype(
  rawFamily: unknown, rawDesign: unknown, choices: TemplateChoices,
  carrier: { durationFrames: number; edits: ClipEditsV2 },
): TemplateCompileResult {
  const family = validateTemplateFamily(rawFamily)
  const design = validateTemplateDesign(rawDesign, family)
  id(choices.instanceId, 'instance')
  if (carrier.durationFrames !== family.totalFrames) throw new Error('carrier: exact frame count required')
  if (carrier.edits.inserts?.length) throw new Error('carrier: post-composite inserts not permitted')
  const allowed = new Set(family.slots.map(s => s.id))
  for (const k of Object.keys(choices.media)) if (!allowed.has(k)) throw new Error(`unknown media choice: ${k}`)
  const textKeys = new Set(family.texts.map(t => t.id))
  for (const k of Object.keys(choices.texts ?? {})) if (!textKeys.has(k)) throw new Error(`unknown text choice: ${k}`)
  const sources: NonNullable<ClipEditsV2['sources']> = []
  const sourceIds = new Map<string, string>()
  const sequence: TemplateSequenceItem[] = []
  const slotToItemIds: Record<string, string> = {}
  const segments: NonNullable<ClipEditsV2['sourceSegments']> = []
  for (const slot of family.slots) {
    const asset = validateAsset(choices.media[slot.id], slot.media === 'either' ? ['image','video'] : [slot.media], slot.id)
    const inFrame = slot.sourceInFrame ?? 0
    if (asset.kind === 'video' && inFrame + slot.durationFrames > (asset.durationFrames ?? 0))
      throw new Error(`slot ${slot.ordinal} (${slot.id}): video too short; choose a longer clip or shorten the slot`)
    if (slot.sourceAudio === 'source' && asset.kind !== 'video') throw new Error(`slot ${slot.id}: missing video audio`)
    const key = `${asset.kind}:${asset.id}`
    let sourceId = sourceIds.get(key)
    if (!sourceId) {
      sourceId = seededId(choices.instanceId, family.familyId, String(family.revision), 'source', asset.id)
      sourceIds.set(key, sourceId)
      sources.push({ id: sourceId, ref: 'upload', refId: asset.id, mediaType: asset.kind, ...(asset.durationFrames ? { durationMs: ms(asset.durationFrames) } : {}) })
    }
    const itemId = seededId(choices.instanceId, family.familyId, String(family.revision), 'slot', slot.id)
    slotToItemIds[slot.id] = itemId
    sequence.push({ id: itemId, slotId: slot.id, assetId: asset.id, outputStartFrame: slot.startFrame, outputEndFrame: slot.startFrame + slot.durationFrames, mediaInFrame: inFrame, fit: slot.fit, sourceAudio: slot.sourceAudio })
    segments.push({ id: itemId, sourceId, startMs: ms(slot.startFrame), endMs: ms(slot.startFrame + slot.durationFrames), ...(asset.kind === 'video' ? { inMs: ms(inFrame), audio: slot.sourceAudio === 'mute' ? 'main' : 'source' } : {}), fit: slot.fit })
  }
  const texts = family.texts.map(t => {
    const text = choices.texts?.[t.id] ?? t.defaultText
    if (typeof text !== 'string' || !text.trim() || Array.from(text).length > t.maxChars) throw new Error(`text ${t.id}: limit ${t.maxChars} characters`)
    return { id: seededId(choices.instanceId, family.familyId, String(family.revision), 'text', t.id), text, startMs: ms(t.startFrame), endMs: ms(t.startFrame + t.durationFrames), x: t.x, y: t.y, style: { font: t.font, size: t.size, color: t.color, align: 'center' as const, case: 'none' as const } }
  })
  let music = null
  if (choices.music) {
    if (design.musicPolicy === 'none') throw new Error('design: music forbidden')
    const asset = validateAsset(choices.music, ['audio'], 'music')
    if (asset.license.provenance === 'user-owned' || asset.license.provenance === 'licensed' || asset.license.provenance === 'first-party') {
      music = { generationId: asset.id, uploadId: asset.id, startMs: 0, endMs: ms(family.totalFrames), loop: true }
    }
  }
  // The caller must supply a purpose-generated neutral silent carrier as the clock.
  // No user media is flattened into the carrier; do not use the result in legacy export.
  const edits: ClipEditsV2 = {
    ...structuredClone(carrier.edits),
    sources, sourceSegments: segments, textItems: texts,
    audio: { music, sfx: [] }, captions: { ...carrier.edits.captions, enabled: false },
    trim: { in: 0, out: ms(family.totalFrames) }, cutRanges: [],
  }
  return {
    edits,
    sequence: { v: 1, fps: 30, totalFrames: family.totalFrames, items: sequence,
      provenance: { instanceId: choices.instanceId, familyId: family.familyId, familyRevision: family.revision, designId: design.designId, designRevision: design.revision } },
    slotToItemIds,
    warnings: ['EXPERIMENTAL_SEQUENCE_ADAPTER_NOT_CONNECTED', 'CROSS_SOURCE_TRANSITIONS_UNSUPPORTED', 'FRAME_ACCURATE_WORKER_PARITY_NOT_VERIFIED'],
    renderable: false,
  }
}
