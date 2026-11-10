import { getStudioModel } from '@/lib/studio/models'

/** B3a: provider duration may exceed the editorial window; do not extend the timeline. */
export type AdGenerationWindow = {
  generationDurationSec: number
  trimInMs: number
  trimOutMs: number
}

export function adGenerationWindow(modelId: string, plannedDurationSec: number): AdGenerationWindow {
  console.info('[ad-studio:b3] duration_resolve_begin', { modelId, plannedDurationSec })
  const model = getStudioModel(modelId)
  if (!model || model.kind !== 'video' || !Number.isFinite(plannedDurationSec) || plannedDurationSec <= 0) {
    throw new Error('Ad Studio scene has an invalid video model or duration.')
  }
  const generationDurationSec = [...model.durationsSec]
    .filter(duration => duration >= plannedDurationSec)
    .sort((a, b) => a - b)[0]
  if (generationDurationSec === undefined) throw new Error('No supported duration can cover this scene.')
  const result = { generationDurationSec, trimInMs: 0, trimOutMs: Math.round(plannedDurationSec * 1000) }
  console.info('[ad-studio:b3] duration_resolve_complete', { modelId, ...result })
  return result
}
