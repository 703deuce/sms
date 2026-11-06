import { editsVersionHash, type ClipEditsV2 } from '@/lib/clips/edits'
import { type ExportAspect, type ExportResolution, exportPixelSize, renderVersionHash } from '@/lib/clips/export-aspect'
import { deliverExt, isDefaultDeliver, type ExportDeliver } from '@/lib/clips/export-deliver'
import { clipRenderHashMaterial } from '@/lib/clips/render-cache-key'
import { resolveComposeSpec } from '@/lib/clips/compose-spec'
import { composeSpecV1Enabled } from '@/lib/clips/compose-spec-flags'
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
import { clipExportMediaReady } from '@/lib/clips/clip-export-media'

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

/** FV4b: a QUEUED / RENDERING row older than this is treated as dead (never deduped onto). */
export const IN_FLIGHT_RENDER_MAX_AGE_MS = 8 * 60 * 60 * 1000

/**
 * FV4b: the newest QUEUED / RENDERING render of this clip with the same edits hash that still has a
 * live RENDER_CLIP job (QUEUED / RUNNING). A row whose job is gone (crash, manual fail) is not reused.
 */
export async function findInFlightRender(
  workspaceId: string,
  clipId: string,
  editsHash: string,
  now: number = Date.now(),
) {
  const prisma = getPrisma()
  const render = await prisma.clipRender.findFirst({
    where: {
      clipId,
      workspaceId,
      status: { in: ['QUEUED', 'RENDERING'] },
      editsVersionHash: editsHash,
      createdAt: { gte: new Date(now - IN_FLIGHT_RENDER_MAX_AGE_MS) },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!render) return null
  const job = await prisma.clipJob.findFirst({
    where: {
      clipId,
      type: 'RENDER_CLIP',
      status: { in: ['QUEUED', 'RUNNING'] },
      payload: { path: ['renderId'], equals: render.id },
    },
    select: { id: true },
  })
  return job ? { render, jobId: job.id } : null
}

/**
 * FV4c: the newest QUEUED / RENDERING render of this clip (any edits hash) that still has a live
 * RENDER_CLIP job — the export dialog re-attaches to it after a close / reopen or a page reload.
 */
export async function findActiveRenderForClip(
  workspaceId: string,
  clipId: string,
  now: number = Date.now(),
) {
  const prisma = getPrisma()
  const render = await prisma.clipRender.findFirst({
    where: {
      clipId,
      workspaceId,
      status: { in: ['QUEUED', 'RENDERING'] },
      createdAt: { gte: new Date(now - IN_FLIGHT_RENDER_MAX_AGE_MS) },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!render) return null
  const job = await prisma.clipJob.findFirst({
    where: {
      clipId,
      type: 'RENDER_CLIP',
      status: { in: ['QUEUED', 'RUNNING'] },
      payload: { path: ['renderId'], equals: render.id },
    },
    select: { id: true },
  })
  return job ? { render, jobId: job.id } : null
}

export async function enqueueRenderClip(
  workspaceId: string,
  clipId: string,
  opts: {
    resolution: ExportResolution
    /** Delivery target (may be 4K while compose renders at 1080p). */
    targetResolution?: ExportResolution
    aspect: ExportAspect
    watermark: boolean
    edits: ClipEditsV2
    clipStartMs: number
    clipEndMs: number
    previewKey: string | null
    title: string
    batchId?: string
    deliver?: ExportDeliver | null
  },
) {
  const prisma = getPrisma()
  const clipRow = await prisma.clip.findUniqueOrThrow({ where: { id: clipId }, select: { projectId: true } })
  const targetRes = opts.targetResolution ?? opts.resolution
  const { width: playW, height: playH } = exportPixelSize(opts.aspect, opts.resolution)
  const composeSpec = composeSpecV1Enabled(workspaceId, clipRow.projectId)
    ? resolveComposeSpec(opts.edits, playW, playH)
    : null
  const editsHash = editsVersionHash(opts.edits)
  const stemsRequested = Boolean(opts.deliver?.stems)
  const hashMaterial = clipRenderHashMaterial(editsHash, { composeSpec, deliver: opts.deliver })
  const hash = renderVersionHash(hashMaterial, opts.aspect, targetRes)
  const fmt = opts.deliver && !isDefaultDeliver(opts.deliver) ? deliverExt(opts.deliver) : 'mp4'
  const existing = await prisma.clipRender.findFirst({
    where: { clipId, workspaceId, status: 'READY', editsVersionHash: hash },
    orderBy: { createdAt: 'desc' },
  })
  if (existing?.outputKey) {
    if (stemsRequested && !existing.stemsKey) {
      /* force fresh encode — cached row predates stems or worker stem pack */
    } else {
      const storage = getClipStorage()
      const filename = existing.filename || exportFilename(opts.title)
      let stemsDownloadUrl: string | null = null
      let stemsFilename: string | null = null
      if (existing.stemsKey) {
        stemsFilename = `${filename.replace(/\.[^.]+$/, '') || 'clip'}.stems.zip`
        try {
          stemsDownloadUrl = await createCachedSignedDownloadUrl(storage, existing.stemsKey, {
            downloadFilename: stemsFilename,
            versionHint: `render:${existing.id}:stems`,
          })
        } catch {
          stemsDownloadUrl = null
        }
      }
      return {
        render: existing,
        downloadUrl: await createCachedSignedDownloadUrl(storage, existing.outputKey, { downloadFilename: filename }),
        filename,
        stemsDownloadUrl,
        stemsFilename,
        reused: true,
      }
    }
  }

  // FV4b: the same edits are already rendering (double click, second tab, dialog reopened) —
  // hand back that render instead of starting a duplicate full-length encode.
  const inFlight = await findInFlightRender(workspaceId, clipId, hash)
  if (inFlight) {
    return {
      render: inFlight.render,
      downloadUrl: null as string | null,
      filename: inFlight.render.filename || exportFilename(opts.title),
      reused: false,
      inFlight: true,
      jobId: inFlight.jobId,
    }
  }

  const renderId = createId('rnd')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const baseName = exportFilename(opts.title).replace(/\.[^.]+$/, '')
  const filename = `${baseName}.${fmt}`
  const render = await prisma.clipRender.create({
    data: {
      id: renderId,
      clipId,
      workspaceId,
      status: 'QUEUED',
      resolution: targetRes,
      format: fmt,
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
      payload: {
        renderId,
        editsVersionHash: hash,
        ...(composeSpec ? { composeSpec } : {}),
        ...(opts.deliver && !isDefaultDeliver(opts.deliver) ? { deliver: opts.deliver, targetResolution: targetRes } : {}),
      },
    },
  })

  return { render, downloadUrl: null as string | null, filename, reused: false, inFlight: false, jobId }
}

export async function retryFailedRender(workspaceId: string, renderId: string) {
  const prisma = getPrisma()
  const render = await prisma.clipRender.findFirst({ where: { id: renderId, workspaceId } })
  if (!render) throw new Error('Not found')
  if (render.status !== 'FAILED') throw new Error('Only failed exports can be retried')

  const clip = await prisma.clip.findUnique({
    where: { id: render.clipId },
    include: { project: {
      select: { settings: true, proxyKey: true, upload: { select: { key: true } } },
    } },
  })
  if (!clip || !clipExportMediaReady(clip, clip.project)) {
    throw new Error('Clip source media is not available')
  }

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

  const failedJob = await prisma.clipJob.findFirst({
    where: {
      clipId: clip.id,
      type: 'RENDER_CLIP',
      payload: { path: ['renderId'], equals: renderId },
    },
    orderBy: { createdAt: 'desc' },
    select: { payload: true },
  })
  const failedPayload = failedJob?.payload as {
    editsVersionHash?: string
    composeSpec?: unknown
    deliver?: ExportDeliver
    targetResolution?: ExportResolution
  } | null

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
      payload: {
        renderId,
        editsVersionHash: render.editsVersionHash ?? failedPayload?.editsVersionHash ?? '',
        ...(failedPayload?.composeSpec ? { composeSpec: failedPayload.composeSpec } : {}),
        ...(failedPayload?.deliver ? { deliver: failedPayload.deliver, targetResolution: failedPayload.targetResolution } : {}),
      },
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
