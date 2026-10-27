import { toast } from 'sonner'
import { exportClipWithOptions, getRenderStatus } from '@/lib/clips-api'
import type { ClipProjectSettings } from '@/lib/clips/settings'

export type ClipExportDownload = {
  downloadUrl: string
  filename: string
}

function exportProgressLabel(progress: number | null | undefined, phase: string | null | undefined): string {
  const pct = progress != null && progress > 0 ? `${Math.round(progress)}%` : null
  const phaseLabel = phase?.replace(/_/g, ' ')?.trim()
  if (pct && phaseLabel) return `Exporting — ${pct} (${phaseLabel})…`
  if (pct) return `Exporting — ${pct}…`
  if (phaseLabel) return `Exporting — ${phaseLabel}…`
  return 'Exporting clip…'
}

/** Grid / results download — preview reuse when edits are default; otherwise waits on render job. */
export async function exportClipDownload(
  clipId: string,
  opts?: { aspect?: ClipProjectSettings['aspectRatio']; resolution?: '720p' | '1080p' },
): Promise<ClipExportDownload> {
  const toastId = toast.loading('Starting export…')
  try {
    const data = await exportClipWithOptions(clipId, {
      aspect: opts?.aspect ?? '9:16',
      resolution: opts?.resolution ?? '720p',
      watermark: false,
      removeDeadAir: false,
      exportSfx: 'off',
    })
    const filename = data.filename || 'clip.mp4'
    if (data.downloadUrl) {
      toast.success('Export ready — download starting', { id: toastId })
      return { downloadUrl: data.downloadUrl, filename }
    }
    const renderId = data.renderId
    if (!renderId) {
      throw new Error('Export did not start')
    }
    toast.loading(exportProgressLabel(null, 'queued'), { id: toastId })
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise((r) => setTimeout(r, attempt < 3 ? 1500 : 2500))
      const row = await getRenderStatus(renderId)
      if (row.status === 'READY' && row.downloadUrl) {
        toast.success('Export ready — download starting', { id: toastId })
        return { downloadUrl: row.downloadUrl, filename: row.filename || filename }
      }
      if (row.status === 'FAILED') {
        throw new Error(row.error || 'Export failed')
      }
      toast.loading(exportProgressLabel(row.progress, row.phase), { id: toastId })
    }
    throw new Error('Export timed out — open the clip editor and try Export again')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed'
    toast.error(message, { id: toastId })
    throw err
  }
}
