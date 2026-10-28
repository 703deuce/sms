/** Headline band layout constants + helpers (leaf — no export-template / layout-preview imports). */

export const STREAM_HEADLINE_BAR_FRAC = 0.2
export const STREAM_HEADLINE_FOOTER_FRAC = 0.28

export const LAYOUT_HEADLINE_PREVIEW_FRAC = STREAM_HEADLINE_BAR_FRAC

const SPLIT_LAYOUT_MODES = new Set([
  'split',
  'grid3',
  'grid4',
  'dynamic',
  'screen_pip',
  'split_debate',
  'grid',
  'two_up',
])

/** Preview + export template: reserve top band for headline bar. */
export function layoutReservesHeadlineBand(mode: string): boolean {
  return mode === 'full_frame' || mode === 'fit_top'
}

/** Headline bar only on single-view layouts (export-time rule). */
export function headlineBarAllowedForLayout(mode: string): boolean {
  const m = String(mode || 'speaker_follow')
  if (SPLIT_LAYOUT_MODES.has(m)) return false
  return true
}

/** Editor + preview: headline band is allowed and reserved for this layout. */
export function editorHeadlineBandAllowed(mode: string): boolean {
  return headlineBarAllowedForLayout(mode) && layoutReservesHeadlineBand(mode)
}
