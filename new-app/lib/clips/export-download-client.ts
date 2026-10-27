import { exportClip, getRenderStatus } from '@/lib/clips-api'

export type ClipExportDownload = {
  downloadUrl: string
  filename: string
}

/** Grid / results download — waits for render when export is queued (preview reuse returns immediately). */
export async function exportClipDownload(clipId: string): Promise<ClipExportDownload> {
  const data = await exportClip(clipId)
  const filename = data.filename || data.download || 'clip.mp4'
  if (data.downloadUrl) {
    return { downloadUrl: data.downloadUrl, filename }
  }
  const renderId = data.renderId
  if (!renderId) {
    throw new Error('Export did not start')
  }
  for (let attempt = 0; attempt < 90; attempt += 1) {
    await new Promise((r) => setTimeout(r, attempt < 3 ? 1500 : 2500))
    const row = await getRenderStatus(renderId)
    if (row.status === 'READY' && row.downloadUrl) {
      return { downloadUrl: row.downloadUrl, filename: row.filename || filename }
    }
    if (row.status === 'FAILED') {
      throw new Error(row.error || 'Export failed')
    }
  }
  throw new Error('Export timed out — open the clip editor and try Export again')
}
