import type { ClipEditsV2 } from '@/lib/clips/edits'
import {
  formatHeadlineForExport,
  normalizeExportTemplate,
  wrapHeadlineDisplayLines,
} from '@/lib/clips/export-template'
import { resolveLayers, type HeadlineLayer } from '@/lib/clips/layers'

/** Headline display lines for fit_top overlayLayout line count (preview + export overlay). */
export function fitTopHeadlineLines(edits: ClipEditsV2): string[] {
  const tpl = normalizeExportTemplate(edits.exportTemplate)
  let layers: ReturnType<typeof resolveLayers> = []
  try {
    layers = resolveLayers(edits)
  } catch {
    layers = []
  }
  const headlineLayer = layers.find((l): l is HeadlineLayer => l.id === 'headline' && l.type === 'headline')
  const headlineOn = Boolean(
    tpl?.headlineBar?.enabled && (tpl.headlineBar.text?.trim() || tpl.suggestedHeadline),
  )
  if (!headlineOn && !headlineLayer?.enabled) return []
  const headline = formatHeadlineForExport(
    tpl?.headlineBar?.text?.trim() || tpl?.suggestedHeadline?.trim() || headlineLayer?.text?.trim() || '',
  )
  return headline ? wrapHeadlineDisplayLines(headline) : []
}
