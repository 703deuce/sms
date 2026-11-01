import type { ClipEditsV2 } from '@/lib/clips/edits'
import { layoutUsesLetterboxBlurPreview } from '@/lib/clips/layout-preview'
import { layerFxOf } from '@/lib/clips/editor/layer-fx'
import { t6TemplatesEnabled } from '@/lib/clips/t6-feature-flags'
import { T6_TEMPLATES_BY_ID } from '@/lib/clips/templates/registry'

const MULTI_VIDEO_LAYOUTS = new Set([
  'facecam_stack',
  'facecam_pip',
  'screen_pip',
  'stack',
  'split',
  'grid3',
  'grid4',
  'two_up',
])

/** Chroma key on the main video only when export/preview can show a single full-frame picture. */
export function mainKeyAllowed(edits: ClipEditsV2): boolean {
  if (edits.sourceSegments?.length) return false
  const mode = edits.layout?.mode ?? 'speaker_follow'
  if (layoutUsesLetterboxBlurPreview(mode)) return false
  if (MULTI_VIDEO_LAYOUTS.has(mode)) return false
  if (t6TemplatesEnabled() && edits.layout?.template?.id && T6_TEMPLATES_BY_ID[edits.layout.template.id]) return false
  return true
}

export function mainFxOf(edits: ClipEditsV2) {
  return layerFxOf(edits, 'video')
}
