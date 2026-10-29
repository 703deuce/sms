/** Headline band layout constants + helpers (leaf — no export-template / layout-preview imports). */

import geom from '@/lib/clips/overlay-geometry.json'

export const STREAM_HEADLINE_BAR_FRAC = geom.exportBar.barFrac
export const STREAM_HEADLINE_FOOTER_FRAC = geom.exportBar.footerFrac

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

/** Preview: reserve top band only for fit_top (export renders full_frame as fit_blur without band). */
export function layoutReservesHeadlineBand(mode: string): boolean {
  return mode === 'fit_top'
}

/** Layer / export placement for headline + badge overlays. */
export function headlineLayerPlacement(mode: string): 'fit_top_band' | 'export_bar' {
  return mode === 'fit_top' ? 'fit_top_band' : 'export_bar'
}

export function splitLayoutMode(mode: string): boolean {
  return SPLIT_LAYOUT_MODES.has(String(mode || ''))
}

/** Headline placement helper copy for editor. */
export function headlinePlacementNote(mode: string): string {
  if (mode === 'fit_top') {
    return 'Headline appears in the white band above the video (stream layout).'
  }
  if (splitLayoutMode(mode)) {
    return 'On split layouts, headline and badge render in the export bar below the video.'
  }
  if (mode === 'full_frame') {
    return 'Shown in the export bar (preview uses blur fill, no top band).'
  }
  return 'Shown in the export bar.'
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
