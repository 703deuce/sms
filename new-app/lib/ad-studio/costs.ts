import type { AdStudioCosts, AdStudioDurationSec, AdStudioMode } from './types'

/** Placeholders until John sets integers. Never invent a cash price. */
export const AD_STUDIO_COSTS: AdStudioCosts = {
  storyline_15: null,
  storyline_30: null,
  image_to_ad_15: null,
  image_to_ad_30: null,
}

export function costKey(mode: AdStudioMode, durationSec: AdStudioDurationSec): keyof AdStudioCosts {
  return mode === 'storyline'
    ? durationSec === 30
      ? 'storyline_30'
      : 'storyline_15'
    : durationSec === 30
      ? 'image_to_ad_30'
      : 'image_to_ad_15'
}

export function estimateCredits(
  mode: AdStudioMode,
  durationSec: AdStudioDurationSec,
  costs: AdStudioCosts = AD_STUDIO_COSTS,
): number | null {
  return costs[costKey(mode, durationSec)]
}
