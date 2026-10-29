import type { ClipEditsV2 } from '@/lib/clips/edits'
import { formatHeadlineForExport, normalizeExportTemplate } from '@/lib/clips/export-template'
import { headlineBarAllowedForLayout } from '@/lib/clips/headline-band-layout'
import { overlayLayout, type StreamOverlayLayout } from '@/lib/clips/stream-overlay-layout'

const STREAM_FRAME_MODES = new Set(['fit_blur', 'fit_top', 'full_frame'])

/** Parity with worker layout_router.export_stream_headline_compose_active */
export function exportStreamHeadlineComposeActive(edits: ClipEditsV2): boolean {
  const mode = edits.layout?.mode ?? 'speaker_follow'
  if (STREAM_FRAME_MODES.has(mode)) return true
  const tpl = normalizeExportTemplate(edits.exportTemplate)
  if (!tpl) return false
  const hb = tpl.headlineBar
  if (!hb?.enabled) return false
  const text = formatHeadlineForExport(hb.text || tpl.suggestedHeadline || '')
  return Boolean(text.trim())
}

/** Rick fit_top overlay rects in editor preview + export compose (speaker_follow + headline). */
export function usesStreamHeadlineBandOverlay(edits: ClipEditsV2): boolean {
  const mode = edits.layout?.mode ?? 'speaker_follow'
  if (mode === 'fit_top') return true
  if (!headlineBarAllowedForLayout(mode)) return false
  const tpl = normalizeExportTemplate(edits.exportTemplate)
  if (!tpl?.headlineBar?.enabled) return false
  const text = formatHeadlineForExport(tpl.headlineBar.text || tpl.suggestedHeadline || '')
  return Boolean(text.trim())
}

export function resolveStreamOverlayLayout(edits: ClipEditsV2, headlineLineCount: number): StreamOverlayLayout {
  return overlayLayout(Math.max(2, headlineLineCount || 2))
}
