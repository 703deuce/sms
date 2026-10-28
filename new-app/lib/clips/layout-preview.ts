import type { ClipEditsV2 } from '@/lib/clips/edits'
export {
  LAYOUT_HEADLINE_PREVIEW_FRAC,
  layoutReservesHeadlineBand,
} from '@/lib/clips/headline-band-layout'

/** Preview: 16:9 contained with blurred fill (no speaker crop track). */
export function layoutUsesLetterboxBlurPreview(mode: ClipEditsV2['layout']['mode'] | string): boolean {
  return mode === 'fit_blur' || mode === 'full_frame'
}

/** Rick fit_top: preview.mp4 is pre-composed; HTML overlay uses overlayLayout(). */
export function layoutUsesStreamFitTopPreview(mode: ClipEditsV2['layout']['mode'] | string): boolean {
  return mode === 'fit_top'
}
