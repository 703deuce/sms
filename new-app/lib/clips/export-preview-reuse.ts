import type { ClipEditsV2 } from '@/lib/clips/edits'
import { previewExportMatchesDefault } from '@/lib/clips/export-edits-match'
import type { ExportAspect, ExportResolution } from '@/lib/clips/export-aspect'

/** M4 clipper preview.mp4 is always 9:16 @ 720p (see worker pipeline / speakercrop). */
export const CLIP_PREVIEW_EXPORT_ASPECT: ExportAspect = '9:16'
export const CLIP_PREVIEW_EXPORT_RESOLUTION: ExportResolution = '720p'

export function exportRequestMatchesClipPreview(
  aspect: ExportAspect,
  resolution: ExportResolution,
): boolean {
  return aspect === CLIP_PREVIEW_EXPORT_ASPECT && resolution === CLIP_PREVIEW_EXPORT_RESOLUTION
}

/** True only when the client may download preview.mp4 without a RENDER_CLIP job. */
export function canReuseClipPreviewForExport(opts: {
  aspect: ExportAspect
  resolution: ExportResolution
  edits: ClipEditsV2
  bounds: { clipStartMs: number; clipEndMs: number }
}): boolean {
  return (
    exportRequestMatchesClipPreview(opts.aspect, opts.resolution) &&
    previewExportMatchesDefault(opts.edits, opts.bounds)
  )
}
