import type { ClipEditsV2 } from '@/lib/clips/edits'

function captionsKey(c: ClipEditsV2['captions']) {
  return JSON.stringify({
    presetId: c?.presetId,
    animation: c?.animation,
    size: c?.size,
    position: c?.position,
    case: c?.case,
    customPresetId: c?.customPresetId,
  })
}

function musicKey(edits: ClipEditsV2) {
  const m = edits.audio?.music
  if (!m) return 'none'
  return JSON.stringify({ generationId: m.generationId, volume: m.volume, duckDepth: m.duckDepth })
}

/** Count producer-visible field changes (captions + music mix). */
export function countProducerFieldChanges(before: ClipEditsV2, after: ClipEditsV2): number {
  let n = 0
  if (captionsKey(before.captions) !== captionsKey(after.captions)) n += 1
  if (musicKey(before) !== musicKey(after)) n += 1
  return n
}

export function captionsUnchanged(before: ClipEditsV2, after: ClipEditsV2): boolean {
  return captionsKey(before.captions) === captionsKey(after.captions)
}
