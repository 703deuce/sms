import { normalizeSourceSegmentPlayback, sourcePlaybackSample } from '@/lib/clips/editor/sources'
import type { TemplateSequenceItem, TemplateSequenceV1 } from './sequence-contract'

/**
 * B3 output/item clock is integer authored frames; mediaFrame may be fractional under slot speed.
 * This is a pure mapping helper, not a render capability. Never infer a unique
 * output position from a repeated source without the item ID.
 */
export type SequenceFrameLocation = {
  itemId: string
  slotId: string
  sourceId: string
  outputFrame: number
  itemLocalFrame: number
  mediaFrame: number
}
function frame(n: number, max: number, what: string) {
  if (!Number.isInteger(n) || n < 0 || n >= max) throw new RangeError(`${what}: frame outside sequence`)
}
function assertValidSequence(sequence: TemplateSequenceV1) {
  if (sequence.v !== 1 || sequence.fps !== 30 || !Number.isInteger(sequence.totalFrames) || sequence.totalFrames <= 0)
    throw new Error('unsupported sequence version or frame clock')
  let cursor = 0
  const itemIds = new Set<string>()
  for (const item of sequence.items) {
    if (itemIds.has(item.id)) throw new Error('duplicate sequence item ID')
    itemIds.add(item.id)
    if (!Number.isInteger(item.outputStartFrame) || !Number.isInteger(item.outputEndFrame) ||
      !Number.isInteger(item.mediaInFrame) || item.mediaInFrame < 0 ||
      item.outputStartFrame !== cursor || item.outputEndFrame <= cursor ||
      !Number.isFinite(item.speed ?? 1) || (item.speed ?? 1) < 0.25 || (item.speed ?? 1) > 4)
      throw new Error('sequence has a gap, overlap or invalid media in-point')
    if (item.playback) {
      const normalized = normalizeSourceSegmentPlayback(item.playback)
      if (!normalized || normalized.outputFrames !== item.outputEndFrame - item.outputStartFrame || item.speed != null)
        throw new Error('sequence has invalid slot-local playback')
    }
    cursor = item.outputEndFrame
  }
  if (cursor !== sequence.totalFrames) throw new Error('sequence does not cover full duration')
}
export function outputToSequenceFrame(sequence: TemplateSequenceV1, outputFrame: number): SequenceFrameLocation {
  assertValidSequence(sequence)
  frame(outputFrame, sequence.totalFrames, 'output')
  const item = sequence.items.find(i => i.outputStartFrame <= outputFrame && outputFrame < i.outputEndFrame)!
  const local = outputFrame - item.outputStartFrame
  return {
    itemId: item.id, slotId: item.slotId, sourceId: item.assetId,
    outputFrame, itemLocalFrame: local,
    mediaFrame: item.mediaInFrame + (item.playback
      ? sourcePlaybackSample(item.playback, local).mediaOffsetFrame
      : local * (item.speed ?? 1)),
  }
}
export function itemLocalToSequenceFrame(sequence: TemplateSequenceV1, itemId: string, itemFrame: number): SequenceFrameLocation {
  assertValidSequence(sequence)
  const item = sequence.items.find(i => i.id === itemId)
  if (!item) throw new Error('unknown sequence item')
  frame(itemFrame, item.outputEndFrame - item.outputStartFrame, 'item-local')
  return outputToSequenceFrame(sequence, item.outputStartFrame + itemFrame)
}
/** A reused asset may appear in many items; return ALL matching output positions. */
export function sourceToSequenceFrames(sequence: TemplateSequenceV1, assetId: string, mediaFrame: number): SequenceFrameLocation[] {
  assertValidSequence(sequence)
  if (!Number.isFinite(mediaFrame) || mediaFrame < 0) throw new RangeError('invalid media frame')
  const out: SequenceFrameLocation[] = []
  for (const item of sequence.items) {
    if (item.assetId !== assetId) continue
    if (item.playback) {
      for (let local = 0; local < item.outputEndFrame - item.outputStartFrame; local++) {
        const candidate = item.mediaInFrame + sourcePlaybackSample(item.playback, local).mediaOffsetFrame
        if (Math.abs(candidate - mediaFrame) <= 1e-7)
          out.push(itemLocalToSequenceFrame(sequence, item.id, local))
      }
      continue
    }
    const local = (mediaFrame - item.mediaInFrame) / (item.speed ?? 1)
    const rounded = Math.round(local)
    if (rounded < 0 || rounded >= item.outputEndFrame - item.outputStartFrame || Math.abs(local - rounded) > 1e-7) continue
    out.push(itemLocalToSequenceFrame(sequence, item.id, rounded))
  }
  return out
}
export function frameToMs(frameIndex: number, fps = 30): number {
  if (!Number.isInteger(frameIndex) || frameIndex < 0 || fps !== 30) throw new Error('unsupported frame conversion')
  return Math.round(frameIndex * 1000 / fps)
}
export function sequenceItemAt(sequence: TemplateSequenceV1, frameIndex: number): TemplateSequenceItem {
  const itemId = outputToSequenceFrame(sequence, frameIndex).itemId
  return sequence.items.find(i => i.id === itemId)!
}
