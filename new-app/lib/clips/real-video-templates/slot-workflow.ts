import type {
  TemplateAsset, TemplateChoices, TemplateFamilyV1, TemplateSlot,
} from './sequence-contract'
import { validateTemplateFamily } from './sequence-contract'
import { compileTemplatePlayback, playbackSourceBounds } from './slot-playback'
import type { TemplateMusicDecisionV1 } from './music-sequence'

/** A persisted assignment, never a blob URL or an unregistered local File. */
export type StudioSlotFill = {
  asset: TemplateAsset
  sourceInFrame: number
  fit: 'cover' | 'contain'
  muteSourceAudio: boolean
  focalX: number
  focalY: number
  /** Explicit source-short remedy. Never silently time-stretch video. */
  remedy: 'replace' | 'loop' | 'hold'
  /** User-owned, registered still captured from the final video frame. */
  holdAsset?: TemplateAsset
}
export type StudioDraft = {
  v: 1
  releaseId: string
  draftId: string
  slots: Record<string, StudioSlotFill>
  texts: Record<string, string>
  /** Live style/animation/font overrides for template text fields (preview + export). */
  textLayers?: TemplateChoices['textLayers']
  music?: TemplateAsset
  templateMusic?: TemplateMusicDecisionV1
  /** Explicit user declaration about commercial/export rights to the selected track. */
  musicRightsConfirmed?: boolean
  musicTiming: 'keep' | 'resync'
  brandColor?: string
}
export type StudioMaterialized = {
  family: TemplateFamilyV1
  choices: TemplateChoices
  /** The authored original slot ID for every derived source segment. */
  originalSlotIds: Record<string, string>
}
export type StudioMedia = { id: string; kind: TemplateAsset['kind']; durationFrames?: number }
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const valid = (n: number) => Number.isFinite(n) && Number.isInteger(n)
const derivedId = (id: string, suffix: string, n: number) => `${id.slice(0, 52)}_${suffix}_${n}`
const defaultFill = (asset: TemplateAsset): StudioSlotFill => ({
  asset, sourceInFrame: 0, fit: 'cover', muteSourceAudio: true, focalX: 50, focalY: 50, remedy: 'replace',
})
export function newStudioDraft(releaseId: string, draftId: string): StudioDraft {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(releaseId) || !/^[A-Za-z0-9_-]{8,120}$/.test(draftId))
    throw new Error('Invalid template draft identity')
  return { v: 1, releaseId, draftId, slots: {}, texts: {}, musicTiming: 'keep' }
}
export function assignSelectionInOrder(
  draft: StudioDraft,
  family: TemplateFamilyV1,
  assets: readonly TemplateAsset[],
): { draft: StudioDraft; used: number; rejected: TemplateAsset[] } {
  const slots = { ...draft.slots }
  const rejected: TemplateAsset[] = []
  const emptyByOrdinal = [...family.slots]
    .filter(slot => !slots[slot.id])
    .sort((a, b) => a.ordinal - b.ordinal)
  let slotIndex = 0
  let used = 0
  for (const asset of assets) {
    let placed = false
    while (slotIndex < emptyByOrdinal.length) {
      const slot = emptyByOrdinal[slotIndex]!
      slotIndex++
      if (asset.kind === 'audio' || (slot.media !== 'either' && slot.media !== asset.kind) ||
          (slot.playback && asset.kind !== 'video')) {
        continue
      }
      slots[slot.id] = { ...defaultFill(asset), fit: slot.fit,
        sourceInFrame: asset.kind === 'video' ? slot.handles?.headFrames ?? 0 : 0,
        muteSourceAudio: slot.sourceAudio === 'mute' }
      used++
      placed = true
      break
    }
    if (!placed) rejected.push(asset)
  }
  return { draft: { ...draft, slots }, used, rejected }
}
export function moveSelection<T>(arr: readonly T[], from: number, to: number): T[] {
  if (!valid(from) || !valid(to) || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return [...arr]
  const out = [...arr]
  out.splice(to, 0, ...out.splice(from, 1))
  return out
}
function withOverrides(slot: TemplateSlot, fill: StudioSlotFill): TemplateSlot {
  if (!fill || !fill.asset || (slot.media !== 'either' && slot.media !== fill.asset.kind) ||
      fill.asset.kind === 'audio')
    throw new Error(`Slot ${slot.ordinal} requires ${slot.media} media`)
  if (!valid(fill.sourceInFrame) || fill.sourceInFrame < 0)
    throw new Error(`Slot ${slot.ordinal}: invalid video trim start`)
  if (!Number.isFinite(fill.focalX) || !Number.isFinite(fill.focalY) ||
      fill.focalX < 0 || fill.focalX > 100 || fill.focalY < 0 || fill.focalY > 100)
    throw new Error(`Slot ${slot.ordinal}: focal point out of bounds`)
  if (slot.media === 'video' && fill.asset.kind !== 'video') throw new Error('Slot needs video')
  const shiftX = clamp((50 - fill.focalX) / 2, -25, 25)
  const shiftY = clamp((50 - fill.focalY) / 2, -25, 25)
  return {
    ...slot,
    fit: fill.fit,
    ...(fill.asset.kind === 'image' ? { media: 'image' as const, sourceAudio: 'mute' as const } : {
      media: 'video' as const, sourceAudio: fill.muteSourceAudio ? 'mute' as const : 'source' as const,
      sourceInFrame: fill.sourceInFrame,
    }),
    transform: { ...(slot.transform ?? {}),
      ...(fill.focalX !== 50 ? { x: clamp((slot.transform?.x ?? 0) + shiftX, -100, 100) } : {}),
      ...(fill.focalY !== 50 ? { y: clamp((slot.transform?.y ?? 0) + shiftY, -100, 100) } : {}),
    },
  }
}
function fitParts(slot: TemplateSlot, fill: StudioSlotFill): Array<{ slot: TemplateSlot; asset: TemplateAsset }> {
  const asset = fill.asset
  if (asset.kind === 'image') {
    if (slot.playback) throw new Error(`Slot ${slot.ordinal}: authored playback requires a video clip`)
    return [{ slot, asset }]
  }
  const available = asset.durationFrames
  if (!available || !valid(available)) throw new Error(`Slot ${slot.ordinal}: unknown video duration; reupload or choose another`)
  if (slot.playback) {
    if (fill.remedy !== 'replace')
      throw new Error(`Slot ${slot.ordinal}: Loop/Hold cannot rewrite an authored playback ramp; choose a longer source`)
    const plan = compileTemplatePlayback(slot.playback, slot.durationFrames)
    const inFrame = slot.sourceInFrame ?? 0
    const head = slot.handles?.headFrames ?? 0
    const tail = slot.handles?.tailFrames ?? 0
    const bounds = playbackSourceBounds(plan, inFrame)
    if (inFrame >= head && bounds.minFrame >= 0 && bounds.maxFrame + tail < available)
      return [{ slot, asset }]
    throw new Error(`Slot ${slot.ordinal}: this variable-speed or hold sequence needs a longer source; loop/hold substitution cannot safely rewrite the authored playback`)
  }
  const rate = slot.speed ?? 1
  const tail = slot.handles?.tailFrames ?? 0
  const head = slot.handles?.headFrames ?? 0
  if ((slot.sourceInFrame ?? 0) < head) throw new Error(`Slot ${slot.ordinal}: trim start needs ${head} source-handle frames`)
  const cap = (inFrame: number) => Math.floor((available - inFrame - tail) / rate)
  const need = slot.durationFrames
  if (cap(slot.sourceInFrame ?? 0) >= need) return [{ slot, asset }]
  if (fill.remedy === 'replace') throw new Error(`Slot ${slot.ordinal}: video too short; choose Loop, Hold last frame or a longer video`)
  if (cap(slot.sourceInFrame ?? 0) < 3) throw new Error(`Slot ${slot.ordinal}: video has fewer than 3 usable frames`)
  if (fill.remedy === 'hold') {
    if (!fill.holdAsset || fill.holdAsset.kind !== 'image')
      throw new Error(`Slot ${slot.ordinal}: upload the captured still before holding the last frame`)
    const videoFrames = Math.min(need - 3, cap(slot.sourceInFrame ?? 0))
    if (videoFrames < 3 || need - videoFrames < 3)
      throw new Error(`Slot ${slot.ordinal}: cannot hold fewer than three frames`)
    return [
      { slot: { ...slot, durationFrames: videoFrames }, asset },
      { slot: { ...slot, id: derivedId(slot.id, 'hold', 1), startFrame: slot.startFrame + videoFrames,
        durationFrames: need - videoFrames, media: 'image', sourceAudio: 'mute',
        sourceInFrame: undefined, speed: undefined, motion: undefined,
        transition: 'cut', handles: { headFrames: 0, tailFrames: tail } }, asset: fill.holdAsset },
    ]
  }
  if (fill.remedy !== 'loop') throw new Error('Unknown short-video remedy')
  const out: Array<{ slot: TemplateSlot; asset: TemplateAsset }> = []
  let remaining = need
  let cursor = slot.startFrame
  for (let iteration = 0; remaining > 0; iteration++) {
    if (iteration > 120) throw new Error('Loop exceeds slot budget')
    const inFrame = iteration === 0 ? slot.sourceInFrame ?? 0 : 0
    let count = Math.min(remaining, cap(inFrame))
    if (remaining - count > 0 && remaining - count < 3) count -= 3 - (remaining - count)
    if (count < 3) throw new Error(`Slot ${slot.ordinal}: video too short to loop safely`)
    out.push({ asset, slot: {
      ...slot, id: iteration === 0 ? slot.id : derivedId(slot.id, 'loop', iteration),
      ordinal: slot.ordinal, startFrame: cursor, durationFrames: count, sourceInFrame: inFrame,
      transition: iteration === 0 ? slot.transition : 'cut',
      handles: iteration === 0 ? slot.handles : { headFrames: 0, tailFrames: tail },
      ...(iteration ? { motion: undefined } : {}),
    } })
    cursor += count
    remaining -= count
  }
  return out
}
/** Validates the final exact-clock contract before any server publish or overwrite. */
export function materializeStudioDraft(
  family: TemplateFamilyV1,
  draft: StudioDraft,
  instanceId: string,
): StudioMaterialized {
  if (draft.v !== 1 || !/^[A-Za-z0-9_-]{1,120}$/.test(instanceId)) throw new Error('Invalid studio draft')
  if (Object.keys(draft.slots).some(id => !family.slots.some(slot => slot.id === id)))
    throw new Error('Draft has unknown slot assignments')
  const parts: Array<{ slot: TemplateSlot; asset: TemplateAsset; originalId: string }> = []
  const familySlots = [...family.slots].sort((a, b) => a.startFrame - b.startFrame || a.ordinal - b.ordinal)
  for (const sourceSlot of familySlots) {
    const fill = draft.slots[sourceSlot.id]
    if (!fill) throw new Error(`Slot ${sourceSlot.ordinal} is empty`)
    const slot = withOverrides(sourceSlot, fill)
    for (const part of fitParts(slot, fill)) parts.push({ ...part, originalId: sourceSlot.id })
  }
  if (parts.length > 120) throw new Error('Template expands beyond 120 supported source segments')
  const normalizedSlots = parts
    .map((p, i) => ({ ...p.slot, ordinal: i + 1 }))
    .sort((a, b) => a.startFrame - b.startFrame || a.ordinal - b.ordinal)
    .map((slot, i) => ({ ...slot, ordinal: i + 1 }))
  const recolor = draft.brandColor
  if (recolor && !/^#[0-9a-fA-F]{6}$/.test(recolor)) throw new Error('Invalid brand color')
  const instancedFamily = validateTemplateFamily({ ...family, slots: normalizedSlots,
    texts: recolor ? family.texts.map(text => ({ ...text, color: recolor })) : family.texts,
    graphics: recolor ? family.graphics?.map(graphic => ({ ...graphic, color: recolor })) : family.graphics })
  const choices: TemplateChoices = {
    instanceId, media: {}, texts: draft.texts, textLayers: draft.textLayers,
    ...(draft.music ? { music: draft.music } : {}) }
  const originalSlotIds: Record<string, string> = {}
  for (const p of parts) {
    choices.media[p.slot.id] = p.asset
    originalSlotIds[p.slot.id] = p.originalId
  }
  return { family: instancedFamily, choices, originalSlotIds }
}
export function fillProgress(family: TemplateFamilyV1, draft: StudioDraft): { filled: number; total: number } {
  return { filled: family.slots.filter(s => Boolean(draft.slots[s.id])).length, total: family.slots.length }
}
