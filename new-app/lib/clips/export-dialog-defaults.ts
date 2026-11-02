import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { ExportAspect } from '@/lib/clips/export-aspect'
import type { ExportDeliver } from '@/lib/clips/export-deliver'

/** REGRESSION_BATCH1 §1c: dialog defaults follow the clip, not stale prefs alone. */
export function defaultExportDialogState(edits: ClipEditsV2): {
  aspect: ExportAspect
  resolution: ExportDeliver['targetResolution']
  layoutMode: ClipEditsV2['layout']['mode']
} {
  const aspect = (edits.aspectRatio ?? '9:16') as ExportAspect
  return {
    aspect,
    resolution: '1080p',
    layoutMode: edits.layout?.mode ?? 'speaker_follow',
  }
}

export function exportTitleMatchesResolution(title: string, resolution: string): string {
  const base = title.replace(/\s*@\s*720p|\s*@\s*1080p|\s*@\s*1440p|\s*@\s*2160p|\s*@\s*4K/gi, '').trim()
  return `${base} @ ${resolution}`
}
