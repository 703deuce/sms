import type { ClipBounds, ClipEditsV2 } from '@/lib/clips/edits'
import { defaultEdits, mergeEditsPatch, normalizeEdits } from '@/lib/clips/edits'
import type { ClipExportTemplate } from '@/lib/clips/export-template'
import { CLIP_PREVIEW_EXPORT_ASPECT } from '@/lib/clips/export-preview-reuse'
import type { ClipAiMeta } from '@/lib/clips/clip-results-chips'

const LAYOUT_MODES = new Set<ClipEditsV2['layout']['mode']>([
  'speaker_follow',
  'fit_blur',
  'full_frame',
  'center_crop',
  'subject_follow',
  'split',
  'fill',
  'fit',
  'grid3',
  'grid4',
  'dynamic',
  'auto',
  'screen_pip',
])

/** Worker preview layout ids → editor layout mode (WYSIWYG with preview.mp4). */
export function aiMetaLayoutToEditorMode(meta: ClipAiMeta | null | undefined): ClipEditsV2['layout']['mode'] | null {
  if (!meta) return null
  const raw = String(meta.layoutResolved || meta.layoutMode || '').toLowerCase().replace(/\s+/g, '_')
  if (!raw) return null
  if (raw === 'stack' || raw === 'two_up') return 'split'
  if (LAYOUT_MODES.has(raw as ClipEditsV2['layout']['mode'])) {
    return raw as ClipEditsV2['layout']['mode']
  }
  return null
}

export function burnSafeExportTemplate(existing?: ClipExportTemplate): ClipExportTemplate {
  return {
    ...(existing || {}),
    headlineBar: { enabled: false, text: '' },
    platformBadge: { enabled: false },
    channelLink: { enabled: false, url: undefined },
    suggestedHeadline: undefined,
  }
}

/** Align edits with pipeline preview (9:16 layout, no export overlays) for grid / default download. */
export function coerceEditsForPreviewExport(
  edits: ClipEditsV2,
  aiMeta: unknown,
  bounds: ClipBounds,
): ClipEditsV2 {
  const base = normalizeEdits(edits, bounds)
  const d = defaultEdits(bounds)
  const meta = (aiMeta && typeof aiMeta === 'object' ? aiMeta : null) as ClipAiMeta | null
  const fromMeta = aiMetaLayoutToEditorMode(meta)
  const layoutDefault =
    base.layout.mode === d.layout.mode &&
    (base.layout.shotOverrides?.length ?? 0) === 0 &&
    (base.layout.layoutSegments?.length ?? 0) === 0

  let next = base
  if (fromMeta && layoutDefault) {
    next = mergeEditsPatch(next, { layout: { mode: fromMeta, shotOverrides: [] } }, bounds)
  }
  next = mergeEditsPatch(
    next,
    {
      aspectRatio: CLIP_PREVIEW_EXPORT_ASPECT,
      exportTemplate: burnSafeExportTemplate(next.exportTemplate),
    },
    bounds,
  )
  return normalizeEdits(next, bounds)
}
