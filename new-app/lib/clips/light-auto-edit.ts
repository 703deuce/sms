/** Light auto-edit profile for found clips (mirrors worker light_auto_edit.py). */
import type { ClipEditsV2 } from '@/lib/clips/edits'

export function lightAutoEdit(edits: ClipEditsV2, settings: { autoZoom?: boolean }): ClipEditsV2 {
  const out = { ...edits }
  if (!settings.autoZoom) {
    out.zoom = { ...(out.zoom || { intensity: 1.12, facecamOnly: false }), enabled: false }
  }
  const { silenceTrim: _s, hookOverlay: _h, ...rest } = out as ClipEditsV2 & {
    silenceTrim?: unknown
    hookOverlay?: unknown
  }
  return rest as ClipEditsV2
}
