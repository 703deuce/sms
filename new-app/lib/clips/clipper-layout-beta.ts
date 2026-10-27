import type { ClipProjectSettings } from '@/lib/clips/settings'

/** Multiperson / v2 layouts — beta until worker REFRAME_V2_ENABLED=1. */
export const clipMultipersonBetaLayouts: ClipProjectSettings['layout'][] = [
  'dynamic',
  'split_debate',
  'grid',
  'grid3',
  'grid4',
  'locked_off',
  'split',
]

export function isClipLayoutBeta(layout: string): boolean {
  return clipMultipersonBetaLayouts.includes(layout as ClipProjectSettings['layout'])
}
