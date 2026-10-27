import type { ClipBounds, ClipEditsV2 } from '@/lib/clips/edits'
import { defaultEdits, isDefaultEdits } from '@/lib/clips/edits'
import { exportTemplateOverlaysActive } from '@/lib/clips/export-template'

/** True when pipeline preview.mp4 (9:16 @ 720p, default speakercrop + default captions) matches export. */
export function previewExportMatchesDefault(edits: ClipEditsV2, bounds: ClipBounds): boolean {
  if (exportTemplateOverlaysActive(edits.exportTemplate)) return false
  if (!isDefaultEdits(edits, bounds)) return false
  const d = defaultEdits(bounds)
  if ((edits.broll?.length ?? 0) > 0) return false
  if (edits.zoom?.enabled) return false
  if (edits.silenceTrim?.enabled) return false
  if (edits.audio?.music || (edits.audio?.sfx?.length ?? 0) > 0) return false
  if (edits.layout.mode !== d.layout.mode) return false
  if (edits.aspectRatio && edits.aspectRatio !== '9:16') return false

  const cap = edits.captions ?? {}
  const dcap = d.captions ?? {}
  const keys = ['enabled', 'presetId', 'animation', 'size', 'position', 'case', 'wordsPerLine'] as const
  for (const k of keys) {
    const a = (cap as Record<string, unknown>)[k]
    const b = (dcap as Record<string, unknown>)[k]
    if (a !== undefined && b !== undefined && a !== b) return false
    if (a !== undefined && b === undefined && a !== b) return false
  }
  return true
}
