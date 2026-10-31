import type { ClipEditsV2 } from '@/lib/clips/edits'
import { t6TemplatesEnabled } from '@/lib/clips/t6-feature-flags'
import { resolveTemplateGeometryById, type TemplateSpecV2 } from '@/lib/clips/templates/geometry'
import { signalsOrDefaults } from '@/lib/clips/templates/signals'

/**
 * T6.5: the ONE editor-side template spec. PreviewStage (main 9:16 preview) and the layout
 * studio's small 9:16 preview both render <TemplateStage spec={editorTemplateSpec(...)}> so the
 * panel rects (incl. the geometry.ts face cover) can never disagree.
 */
export function editorTemplateSpec(
  edits: ClipEditsV2,
  aiMeta: Record<string, unknown> | null | undefined,
): TemplateSpecV2 | null {
  if (!t6TemplatesEnabled()) return null
  const tid = edits.layout?.template?.id
  if (!tid) return null
  return resolveTemplateGeometryById(tid, signalsOrDefaults(aiMeta ?? null), edits)
}
