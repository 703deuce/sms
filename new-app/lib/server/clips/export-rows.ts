import type { ClipRenderStatus } from '@prisma/client'
import { exportFilename } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { createSignedDownloadUrlForObjectKey, getClipStorageForObjectKey } from '@/lib/storage'
import { runWithConcurrency } from '@/lib/utils/run-with-concurrency'

const EXPORT_ROW_SIGN_CONCURRENCY = 8

export type ClipExportRowDto = {
  id: string
  clipId: string
  projectId: string
  title: string
  resolution: string
  aspectRatio: string
  batchId: string | null
  watermark: boolean
  status: string
  error: string | null
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

function renderVersionHint(renderId: string, updatedAt: Date, sizeBytes: bigint | null): string {
  const size = sizeBytes != null ? String(sizeBytes) : 'unknown'
  return `render:${renderId}:${updatedAt.getTime()}:${size}`
}

function posterVersionHint(posterKey: string): string {
  return `poster:${posterKey}`
}

function backfillClipRenderSizeBytes(renderId: string, sizeBytes: number): void {
  void getPrisma()
    .clipRender.update({
      where: { id: renderId },
      data: { sizeBytes: BigInt(sizeBytes) },
    })
    .catch(() => {})
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

type ClipRenderRowInput = {
  id: string
  clipId: string
  status: ClipRenderStatus
  error: string | null
  resolution: string
  aspectRatio: string
  batchId: string | null
  watermark: boolean
  filename: string | null
  createdAt: Date
  updatedAt: Date
  expiresAt: Date | null
  sizeBytes: bigint | null
  outputKey: string | null
  clip: { id: string; title: string; projectId: string; posterKey: string | null } | null
}

async function enrichClipRenderRow(r: ClipRenderRowInput): Promise<ClipExportRowDto | null> {
  if (!r.clip) return null
  const fname = r.filename || exportFilename(r.clip.title)
  let posterUrl: string | null = null
  let downloadUrl: string | null = null
  let sizeBytes: number | null = r.sizeBytes != null ? Number(r.sizeBytes) : null
  const versionHint = renderVersionHint(r.id, r.updatedAt, r.sizeBytes)
  try {
    if (r.clip.posterKey) {
      posterUrl = await createSignedDownloadUrlForObjectKey(r.clip.posterKey, {
        versionHint: posterVersionHint(r.clip.posterKey),
      })
    }
    if (r.status === 'READY' && r.outputKey) {
      downloadUrl = await createSignedDownloadUrlForObjectKey(r.outputKey, {
        downloadFilename: fname,
        versionHint,
      })
      if (sizeBytes == null) {
        const storage = await getClipStorageForObjectKey(r.outputKey)
        const probed = await storage.getObjectSizeBytes(r.outputKey)
        if (probed != null) {
          sizeBytes = probed
          backfillClipRenderSizeBytes(r.id, probed)
        }
      }
    }
  } catch {
    /* signed URL failure should not break exports page */
  }
  return {
    id: r.id,
    clipId: r.clipId,
    projectId: r.clip.projectId,
    title: r.clip.title,
    resolution: r.resolution,
    aspectRatio: r.aspectRatio,
    batchId: r.batchId,
    watermark: r.watermark,
    status: r.status,
    error: r.error,
    createdAt: toIso(r.createdAt) ?? new Date(0).toISOString(),
    expiresAt: toIso(r.expiresAt),
    sizeBytes,
    filename: fname,
    posterUrl,
    editorUrl: `/app/clips/${r.clip.projectId}/edit/${r.clipId}`,
    downloadUrl,
  }
}

export async function mapRenderRows(rows: ClipRenderRowInput[]): Promise<ClipExportRowDto[]> {
  const enriched = await runWithConcurrency(rows, EXPORT_ROW_SIGN_CONCURRENCY, (r) =>
    enrichClipRenderRow(r),
  )
  return enriched.filter((row): row is ClipExportRowDto => row != null)
}

type CompositionRenderRowInput = {
  id: string
  status: string
  error: string | null
  resolution: string
  aspectRatio: string
  outputKey: string | null
  createdAt: Date
  updatedAt: Date
  composition: { id: string; title: string; projectId: string; kind: string } | null
}

async function enrichCompositionExportRow(r: CompositionRenderRowInput): Promise<ClipExportRowDto | null> {
  const comp = r.composition
  if (!comp) return null
  const fname = exportFilename(comp.title || 'Composition export')
  let downloadUrl: string | null = null
  const versionHint = `composition-render:${r.id}:${r.updatedAt.getTime()}`
  if (r.status === 'READY' && r.outputKey) {
    try {
      downloadUrl = await createSignedDownloadUrlForObjectKey(r.outputKey, {
        downloadFilename: fname,
        versionHint,
      })
    } catch {
      downloadUrl = null
    }
  }
  return {
    id: r.id,
    clipId: comp.id,
    projectId: comp.projectId,
    title: comp.title || 'Script export',
    resolution: r.resolution,
    aspectRatio: r.aspectRatio,
    batchId: null,
    watermark: false,
    status: r.status,
    error: r.error,
    createdAt: r.createdAt.toISOString(),
    expiresAt: null,
    sizeBytes: null,
    filename: fname,
    posterUrl: null,
    editorUrl: `/app/clips/${comp.projectId}/script`,
    downloadUrl,
  }
}

export async function mapCompositionExportRows(
  rows: CompositionRenderRowInput[],
): Promise<ClipExportRowDto[]> {
  const enriched = await runWithConcurrency(rows, EXPORT_ROW_SIGN_CONCURRENCY, (r) =>
    enrichCompositionExportRow(r),
  )
  return enriched.filter((row): row is ClipExportRowDto => row != null)
}
