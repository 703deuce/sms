import { editsVersionHash, type ClipEditsV2 } from '@/lib/clips/edits'
import { type ExportAspect, type ExportResolution, renderVersionHash } from '@/lib/clips/export-aspect'
import { exportFilename } from '@/lib/server/clips/clips'
import {
  type ClipExportRowDto,
  mapCompositionExportRows,
  mapRenderRows,
  parseExportStatusFilter,
  renderStatusWhere,
} from '@/lib/server/clips/export-rows'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'
import { createId } from '@/lib/supabase/id'

const DEFAULT_EXPORTS_PAGE_SIZE = 40
const MAX_EXPORTS_PAGE_SIZE = 100

function clampExportLimit(limit?: number): number {
  if (limit == null || !Number.isFinite(limit)) return DEFAULT_EXPORTS_PAGE_SIZE
  return Math.min(Math.max(1, Math.floor(limit)), MAX_EXPORTS_PAGE_SIZE)
}

export async function listClipRenders(
  workspaceId: string,
  statusFilter?: 'all' | 'ready' | 'failed',
  limit?: number,
) {
  const prisma = getPrisma()
  const filter = parseExportStatusFilter(statusFilter)
  const take = clampExportLimit(limit)
  const rows = await prisma.clipRender.findMany({
    where: { workspaceId, ...renderStatusWhere(filter) },
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      clip: {
        select: {
          id: true,
          title: true,
          projectId: true,
          posterKey: true,
        },
      },
    },
  })
  return mapRenderRows(rows)
}

async function listCompositionExportRows(
  workspaceId: string,
  filter: 'all' | 'ready' | 'failed',
  limit: number,
): Promise<ClipExportRowDto[]> {
  const prisma = getPrisma()
  const status =
    filter === 'ready' ? 'READY' : filter === 'failed' ? 'FAILED' : undefined
  const rows = await prisma.scriptCompositionRender.findMany({
    where: { workspaceId, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      composition: {
        select: { id: true, title: true, projectId: true, kind: true },
      },
    },
  })
  return mapCompositionExportRows(rows)
}

/** Clip renders plus script composition exports (T2V / Descript editor). */
export async function listWorkspaceExports(
  workspaceId: string,
  statusFilter?: 'all' | 'ready' | 'failed',
  opts?: { limit?: number },
) {
  const filter = parseExportStatusFilter(statusFilter)
  const limit = clampExportLimit(opts?.limit)
  const [clips, compositions] = await Promise.all([
    listClipRenders(workspaceId, filter, limit),
    listCompositionExportRows(workspaceId, filter, limit),
  ])
  return [...clips, ...compositions]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}

export async function getRenderForWorkspace(workspaceId: string, renderId: string) {
  const prisma = getPrisma()
  return prisma.clipRender.findFirst({ where: { id: renderId, workspaceId } })
}

export async function enqueueRenderClip(
  workspaceId: string,
  clipId: string,
  opts: {
    resolution: ExportResolution
    aspect: ExportAspect
    watermark: boolean
    edits: ClipEditsV2
    clipStartMs: number
    clipEndMs: number
    previewKey: string
    title: string
    batchId?: string
  },
) {
  const prisma = getPrisma()
  const editsHash = editsVersionHash(opts.edits)
  const hash = renderVersionHash(editsHash, opts.aspect, opts.resolution)
  const existing = await prisma.clipRender.findFirst({
    where: { clipId, workspaceId, status: 'READY', editsVersionHash: hash },
    orderBy: { createdAt: 'desc' },
  })
  if (existing?.outputKey) {
    const storage = getClipStorage()
    const filename = existing.filename || exportFilename(opts.title)
    return {
      render: existing,
      downloadUrl: await createCachedSignedDownloadUrl(storage, existing.outputKey, { downloadFilename: filename }),
      filename,
      reused: true,
    }
  }

  const renderId = createId('rnd')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const filename = exportFilename(opts.title)
  const render = await prisma.clipRender.create({
    data: {
      id: renderId,
      clipId,
      workspaceId,
      status: 'QUEUED',
      resolution: opts.resolution,
      aspectRatio: opts.aspect,
      batchId: opts.batchId ?? null,
      watermark: opts.watermark,
      filename,
      editsVersionHash: hash,
      expiresAt,
      outputKey: null,
    },
  })

  const jobId = createId('job')
  await prisma.clipJob.create({
    data: {
      id: jobId,
      projectId: (await prisma.clip.findUniqueOrThrow({ where: { id: clipId } })).projectId,
      clipId,
      type: 'RENDER_CLIP',
      status: 'QUEUED',
      payload: { renderId, editsVersionHash: hash },
    },
  })

  return { render, downloadUrl: null as string | null, filename, reused: false, jobId }
}

export async function retryFailedRender(workspaceId: string, renderId: string) {
  const prisma = getPrisma()
  const render = await prisma.clipRender.findFirst({ where: { id: renderId, workspaceId } })
  if (!render) throw new Error('Not found')
  if (render.status !== 'FAILED') throw new Error('Only failed exports can be retried')

  const clip = await prisma.clip.findUnique({ where: { id: render.clipId } })
  if (!clip?.previewKey) throw new Error('Clip preview is not available')

  const activeJobs = await prisma.clipJob.findMany({
    where: {
      clipId: clip.id,
      type: 'RENDER_CLIP',
      status: { in: ['QUEUED', 'RUNNING'] },
    },
    select: { id: true, payload: true },
  })
  for (const job of activeJobs) {
    const payload = job.payload as { renderId?: string } | null
    if (payload?.renderId === renderId) {
      return { renderId, status: 'QUEUED' as const, jobId: job.id }
    }
  }

  await prisma.clipRender.update({
    where: { id: renderId },
    data: {
      status: 'QUEUED',
      error: null,
      outputKey: null,
      sizeBytes: null,
      updatedAt: new Date(),
    },
  })

  const jobId = createId('job')
  await prisma.clipJob.create({
    data: {
      id: jobId,
      projectId: clip.projectId,
      clipId: clip.id,
      type: 'RENDER_CLIP',
      status: 'QUEUED',
      payload: { renderId, editsVersionHash: render.editsVersionHash ?? '' },
    },
  })

  return { renderId, status: 'QUEUED' as const, jobId }
}

/** Idempotent: retries each FAILED render once (skips if a job is already queued). */
export async function requeueFailedClipRenders(workspaceId: string) {
  const prisma = getPrisma()
  const failed = await prisma.clipRender.findMany({
    where: { workspaceId, status: 'FAILED' },
    select: { id: true },
    orderBy: { updatedAt: 'asc' },
    take: 50,
  })
  const results: { renderId: string; jobId?: string; status: string; skipped?: string }[] = []
  for (const row of failed) {
    try {
      const res = await retryFailedRender(workspaceId, row.id)
      results.push({ renderId: row.id, jobId: res.jobId, status: res.status })
    } catch (err) {
      results.push({
        renderId: row.id,
        status: 'skipped',
        skipped: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return results
}

export async function markRenderReady(
  renderId: string,
  outputKey: string,
  sizeBytes: number,
  srtKey?: string | null,
) {
  const prisma = getPrisma()
  return prisma.clipRender.update({
    where: { id: renderId },
    data: { status: 'READY', outputKey, sizeBytes: BigInt(sizeBytes), srtKey: srtKey ?? null, error: null },
  })
}
