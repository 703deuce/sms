import type { ClipEditsV2 } from '@/lib/clips/edits'
import {
  templateFrameToMs,
  templateSeededId,
  validateTemplateDesign,
  validateTemplateFamily,
  type TemplateChoices,
  type TemplateCompileResult,
  type TemplateDesignV1,
  type TemplateFamilyV1,
  type TemplateMotion,
} from '@/lib/clips/real-video-templates/sequence-contract'

export const EDITABLE_TIMELINE_PROOF_VERSION = 1
export const EDITABLE_TIMELINE_FRAME_MS = 1000 / 30

export type StructureItem = {
  id: string
  slotId?: string
  startMs: number
  endMs: number
  sourceId?: string
  audio?: 'main' | 'source' | 'mix'
  speed?: number
  transform?: unknown
  fx?: unknown
}
export type StructureCut = { id: string; srcMs: number }
export type StructureTransition = { id: string; srcMs: number; type: string; durMs: number }
export type StructureLayer = {
  id: string
  kind: 'text' | 'graphic'
  startMs: number
  endMs: number
  animation?: unknown
}
export type StructureMusic = { id: string; uploadId?: string; startMs: number; endMs: number; loop: boolean }
export type StructureKeyframes = { id: string; target: string; prop: string; timesMs: number[] }

export type EditableTimelineStructure = {
  mediaItems: StructureItem[]
  cuts: StructureCut[]
  transitions: StructureTransition[]
  layers: StructureLayer[]
  music: StructureMusic | null
  keyframes: StructureKeyframes[]
  inserts: string[]
}

export type EditableTimelineStructureProof = {
  v: typeof EDITABLE_TIMELINE_PROOF_VERSION
  fps: 30
  expected: EditableTimelineStructure
  actual: EditableTimelineStructure
  errors: string[]
  matches: boolean
}

const sortById = <T extends { id: string }>(rows: T[]) => rows.sort((a, b) => a.id.localeCompare(b.id))
const cutId = (left: string, right: string) => `cut:${left}->${right}`
const transitionId = (left: string, right: string) => `transition:${left}->${right}`
const kfId = (target: string, prop: string) => `kf:${target}:${prop}`

function motionRows(target: string, motion: TemplateMotion | undefined, durationFrames: number): StructureKeyframes[] {
  if (!motion) return []
  const defaults = { x: 0, y: 0, scale: 100, rotation: 0 } as const
  const end = templateFrameToMs(durationFrames - 1)
  const out: StructureKeyframes[] = []
  for (const prop of ['x','y','scale','rotation'] as const) {
    const from = motion.from?.[prop] ?? defaults[prop]
    const to = motion.to?.[prop] ?? from
    if (from === defaults[prop] && to === defaults[prop]) continue
    out.push({ id: kfId(target, prop), target, prop, timesMs: end > 0 ? [0, end] : [0] })
  }
  return out
}

function expectedAnimation(raw: TemplateFamilyV1['texts'][number]['animation'] | undefined) {
  if (!raw) return undefined
  return {
    ...(raw.in ? { in: { type: raw.in.type, unit: raw.in.unit, durMs: templateFrameToMs(raw.in.durationFrames) } } : {}),
    ...(raw.out ? { out: { type: raw.out.type, unit: raw.out.unit, durMs: templateFrameToMs(raw.out.durationFrames) } } : {}),
    ...(raw.loop ? { loop: { type: raw.loop.type, periodMs: templateFrameToMs(raw.loop.periodFrames) } } : {}),
  }
}

export function expectedEditableTimelineStructure(
  family: TemplateFamilyV1,
  design: TemplateDesignV1,
  choices: TemplateChoices,
  compiled: Pick<TemplateCompileResult, 'slotToItemIds'>,
): EditableTimelineStructure {
  const mediaItems = family.slots.map((slot) => {
    const asset = choices.media[slot.id]
    return {
      id: compiled.slotToItemIds[slot.id]!,
      slotId: slot.id,
      startMs: templateFrameToMs(slot.startFrame),
      endMs: templateFrameToMs(slot.startFrame + slot.durationFrames),
      ...(asset?.kind === 'video'
        ? { audio: slot.sourceAudio === 'source' ? 'source' as const : 'main' as const }
        : {}),
      ...(slot.speed != null ? { speed: slot.speed } : {}),
      ...(slot.transform ? { transform: slot.transform } : {}),
      ...(slot.fx ? { fx: slot.fx } : {}),
    }
  })
  const cuts: StructureCut[] = []
  const transitions: StructureTransition[] = []
  for (let i = 1; i < family.slots.length; i++) {
    const left = mediaItems[i - 1]!, right = mediaItems[i]!
    cuts.push({ id: cutId(left.id, right.id), srcMs: right.startMs })
    const tr = family.slots[i]!.transition
    if (tr !== 'cut') transitions.push({
      id: transitionId(left.id, right.id),
      srcMs: right.startMs,
      type: tr.type,
      durMs: templateFrameToMs(tr.durationFrames),
    })
  }
  const layers: StructureLayer[] = []
  const keyframes: StructureKeyframes[] = []
  for (const slot of family.slots) {
    keyframes.push(...motionRows(`source:${compiled.slotToItemIds[slot.id]!}`, slot.motion, slot.durationFrames))
  }
  for (const t of family.texts) {
    const id = templateSeededId(choices.instanceId, family.familyId, String(family.revision), 'text', t.id)
    layers.push({ id, kind: 'text', startMs: templateFrameToMs(t.startFrame), endMs: templateFrameToMs(t.startFrame + t.durationFrames),
      ...(t.animation ? { animation: expectedAnimation(t.animation) } : {}) })
    keyframes.push(...motionRows(`text:${id}`, t.motion, t.durationFrames))
  }
  for (const g of family.graphics ?? []) {
    const id = templateSeededId(choices.instanceId, family.familyId, String(family.revision), 'graphic', g.id)
    layers.push({ id, kind: 'graphic', startMs: templateFrameToMs(g.startFrame), endMs: templateFrameToMs(g.startFrame + g.durationFrames),
      ...(g.animation ? { animation: expectedAnimation(g.animation) } : {}) })
    keyframes.push(...motionRows(`text:${id}`, g.motion, g.durationFrames))
  }
  const music = choices.music ? {
    id: choices.music.id, uploadId: choices.music.id, startMs: 0, endMs: templateFrameToMs(family.totalFrames), loop: true,
  } : null
  void design
  return {
    mediaItems,
    cuts,
    transitions,
    layers: sortById(layers),
    music,
    keyframes: sortById(keyframes),
    inserts: [],
  }
}

export function snapshotEditableTimelineStructure(edits: ClipEditsV2): EditableTimelineStructure {
  const segments = [...(edits.sourceSegments ?? [])].sort((a, b) => a.startMs - b.startMs)
  const mediaItems = segments.map((s) => ({
    id: s.id, startMs: s.startMs, endMs: s.endMs, sourceId: s.sourceId,
    ...(s.audio ? { audio: s.audio } : {}),
    ...(s.speed != null ? { speed: s.speed } : {}),
    ...(s.transform ? { transform: s.transform } : {}),
    ...(s.fx ? { fx: s.fx } : {}),
  }))
  const cuts: StructureCut[] = []
  for (let i = 1; i < segments.length; i++) {
    const left = segments[i - 1]!, right = segments[i]!
    if ((edits.videoSplits ?? []).some((ms) => Math.abs(ms - right.startMs) <= EDITABLE_TIMELINE_FRAME_MS))
      cuts.push({ id: cutId(left.id, right.id), srcMs: right.startMs })
  }
  const transitions: StructureTransition[] = []
  for (const t of edits.transitions ?? []) {
    const i = segments.findIndex((s) => Math.abs(s.startMs - t.srcMs) <= EDITABLE_TIMELINE_FRAME_MS)
    if (i <= 0) continue
    transitions.push({ id: transitionId(segments[i - 1]!.id, segments[i]!.id), srcMs: t.srcMs, type: t.type, durMs: t.durMs })
  }
  const layers = (edits.textItems ?? []).map((t) => ({
    id: t.id,
    kind: t.kind === 'shape' ? 'graphic' as const : 'text' as const,
    startMs: t.startMs,
    endMs: t.endMs,
    ...(t.anim ? { animation: t.anim } : {}),
  }))
  const m = edits.audio?.music
  const music = m ? {
    id: m.generationId, ...(m.uploadId ? { uploadId: m.uploadId } : {}),
    startMs: m.startMs ?? 0, endMs: m.endMs ?? edits.trim.out, loop: m.loop === true,
  } : null
  const keyframes = (edits.keyframes ?? []).map((k) => ({
    id: kfId(k.target, k.prop), target: k.target, prop: k.prop, timesMs: k.points.map((p) => p.tMs),
  }))
  return {
    mediaItems,
    cuts,
    transitions: sortById(transitions),
    layers: sortById(layers),
    music,
    keyframes: sortById(keyframes),
    inserts: (edits.inserts ?? []).map((i) => i.id).sort(),
  }
}

function numEq(a: number, b: number) {
  return Math.abs(a - b) <= EDITABLE_TIMELINE_FRAME_MS + 0.01
}
function sameAnimation(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

export function proveEditableTimelineStructure(
  rawFamily: unknown,
  rawDesign: unknown,
  choices: TemplateChoices,
  compiled: TemplateCompileResult,
  actualEdits: ClipEditsV2 = compiled.edits,
): EditableTimelineStructureProof {
  const family = validateTemplateFamily(rawFamily)
  const design = validateTemplateDesign(rawDesign, family)
  const expected = expectedEditableTimelineStructure(family, design, choices, compiled)
  const actual = snapshotEditableTimelineStructure(actualEdits)
  const errors: string[] = []

  if (actual.inserts.length) errors.push('template sequence must not use post-composite inserts')
  if (actual.mediaItems.length !== expected.mediaItems.length) errors.push(`media item count ${actual.mediaItems.length} != ${expected.mediaItems.length}`)
  for (const e of expected.mediaItems) {
    const a = actual.mediaItems.find((x) => x.id === e.id)
    if (!a) { errors.push(`missing media item ${e.id}`); continue }
    if (!numEq(a.startMs, e.startMs) || !numEq(a.endMs, e.endMs)) errors.push(`media timing mismatch ${e.id}`)
    const slotId = Object.entries(compiled.slotToItemIds).find(([, itemId]) => itemId === e.id)?.[0]
    const selected = slotId ? choices.media[slotId] : undefined
    const source = a.sourceId ? actualEdits.sources?.find((row) => row.id === a.sourceId) : undefined
    if (!slotId || !selected || !source || source.ref !== 'upload' || source.refId !== selected.id)
      errors.push(`source assignment mismatch ${e.id}`)
    if (e.audio !== a.audio || e.speed !== a.speed ||
        JSON.stringify(e.transform ?? null) !== JSON.stringify(a.transform ?? null) ||
        JSON.stringify(e.fx ?? null) !== JSON.stringify(a.fx ?? null))
      errors.push(`media edit semantics mismatch ${e.id}`)
  }
  for (const e of expected.cuts) {
    const a = actual.cuts.find((x) => x.id === e.id)
    if (!a || !numEq(a.srcMs, e.srcMs)) errors.push(`missing/moved required cut ${e.id}`)
  }
  for (const e of expected.transitions) {
    const a = actual.transitions.find((x) => x.id === e.id)
    if (!a || a.type !== e.type || !numEq(a.srcMs, e.srcMs) || !numEq(a.durMs, e.durMs))
      errors.push(`transition mismatch ${e.id}`)
  }
  for (const e of expected.layers) {
    const a = actual.layers.find((x) => x.id === e.id)
    if (!a || a.kind !== e.kind || !numEq(a.startMs, e.startMs) || !numEq(a.endMs, e.endMs) || !sameAnimation(a.animation, e.animation))
      errors.push(`layer mismatch ${e.id}`)
  }
  if (expected.music) {
    if (!actual.music || actual.music.id !== expected.music.id || actual.music.uploadId !== expected.music.uploadId ||
        !numEq(actual.music.startMs, expected.music.startMs) || !numEq(actual.music.endMs, expected.music.endMs) || actual.music.loop !== expected.music.loop)
      errors.push('music lane mismatch')
  } else if (actual.music) errors.push('unexpected music lane')
  for (const e of expected.keyframes) {
    const a = actual.keyframes.find((x) => x.id === e.id)
    if (!a || a.timesMs.length !== e.timesMs.length || a.timesMs.some((t, i) => !numEq(t, e.timesMs[i]!)))
      errors.push(`keyframe mismatch ${e.id}`)
  }
  return { v: EDITABLE_TIMELINE_PROOF_VERSION, fps: 30, expected, actual, errors, matches: errors.length === 0 }
}

export function assertEditableTimelineStructure(...args: Parameters<typeof proveEditableTimelineStructure>): EditableTimelineStructureProof {
  const proof = proveEditableTimelineStructure(...args)
  if (!proof.matches) throw new Error(`template editable-timeline structure lost: ${proof.errors.join('; ')}`)
  return proof
}
