import type { ClipRenderStatus } from '@prisma/client'
import { exportFilename } from '@/lib/server/clips/clips'
import { getClipStorage } from '@/lib/storage'

const SIGNED_TTL = 3600

export type ClipExportRowDto = {
  id: string
  clipId: string
  projectId: string
  title: string
  resolution: string
  watermark: boolean
  status: string
  createdAt: string
  expiresAt: string | null
  sizeBytes: number | null
  filename: string
  posterUrl: string | null
  editorUrl: string
  downloadUrl: string | null
}

function toIso(value: Date | null | undefined): string | null {
  if (!value) return null
  const t = value.getTime()
  if (!Number.isFinite(t)) return null
  return value.toISOString()
}

export function parseExportStatusFilter(raw: string | undefined): 'all' | 'ready' | 'failed' {
  const q = (raw || 'all').toLowerCase()
  if (q === 'ready' || q === 'failed') return q
  return 'all'
}

export function renderStatusWhere(filter: 'all' | 'ready' | 'failed'): { status?: ClipRenderStatus } {
  const map = { ready: 'READY', failed: 'FAILED' } as const
  if (filter === 'ready' || filter === 'failed') return { status: map[filter] }
  return {}
}

export async function mapRenderRows(
  rows: Array<{
    id: string
    clipId: string
    status: ClipRenderStatus
    resolution: string
    watermark: boolean
    filename: string | null
    createdAt: Date
    expiresAt: Date | null
    sizeBytes: bigint | null
    outputKey: string | null
    clip: { id: string; title: string; projectId: string; posterKey: string | null } | null
  }>,
): Promise<ClipExportRowDto[]> {
  const storage = getClipStorage()
  const out: ClipExportRowDto[] = []
  for (const r of rows) {
    if (!r.clip) continue
    const fname = r.filename || exportFilename(r.clip.title)
    let posterUrl: string | null = null
    let downloadUrl: string | null = null
    try {
      if (r.clip.posterKey) posterUrl = await storage.createSignedDownloadUrl(r.clip.posterKey, SIGNED_TTL)
      if (r.status === 'READY' && r.outputKey) {
        downloadUrl = await storage.createSignedDownloadUrl(r.outputKey, SIGNED_TTL, { downloadFilename: fname })
      }
    } catch {
      /* signed URL failure should not break exports page */
    }
    out.push({
      id: r.id,
      clipId: r.clipId,
      projectId: r.clip.projectId,
      title: r.clip.title,
      resolution: r.resolution,
      watermark: r.watermark,
      status: r.status,
      createdAt: toIso(r.createdAt) ?? new Date(0).toISOString(),
      expiresAt: toIso(r.expiresAt),
      sizeBytes: r.sizeBytes != null ? Number(r.sizeBytes) : null,
      filename: fname,
      posterUrl,
      editorUrl: `/app/clips/${r.clip.projectId}/edit/${r.clipId}`,
      downloadUrl,
    })
  }
  return out
}
