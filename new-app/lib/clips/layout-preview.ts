import type { ClipEditsV2 } from '@/lib/clips/edits'
import { STREAM_HEADLINE_BAR_FRAC } from '@/lib/clips/export-template'

/** Preview: 16:9 contained with blurred fill (no speaker crop track). */
export function layoutUsesLetterboxBlurPreview(mode: ClipEditsV2['layout']['mode'] | string): boolean {
  return mode === 'fit_blur' || mode === 'full_frame'
}

/** Rick fit_top: preview.mp4 is pre-composed; HTML overlay uses overlayLayout(). */
export function layoutUsesStreamFitTopPreview(mode: ClipEditsV2['layout']['mode'] | string): boolean {
  return mode === 'fit_top'
}

/** Preview + export template: reserve top band for headline bar. */
export function layoutReservesHeadlineBand(mode: ClipEditsV2['layout']['mode'] | string): boolean {
  return mode === 'full_frame'
}

export const LAYOUT_HEADLINE_PREVIEW_FRAC = STREAM_HEADLINE_BAR_FRAC
