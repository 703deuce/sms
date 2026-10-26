import { editsVersionHash, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { exportFilename } from '@/lib/server/clips/clips'
import { mapRenderRows, parseExportStatusFilter, renderStatusWhere } from '@/lib/server/clips/export-rows'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { createId } from '@/lib/supabase/id'

export async function listClipRenders(workspaceId: string, statusFilter?: 'all' | 'ready' | 'failed') {
  const prisma = getPrisma()
  const filter = parseExportStatusFilter(statusFilter)
  const rows = await prisma.clipRender.findMany({
    where: { workspaceId, ...renderStatusWhere(filter) },
    orderBy: { createdAt: 'desc' },
    take: 100,
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

export async function getRenderForWorkspace(workspaceId: string, renderId: string) {
  const prisma = getPrisma()
  return prisma.clipRender.findFirst({ where: { id: renderId, workspaceId } })
}

export async function enqueueRenderClip(
  workspaceId: string,
  clipId: string,
  opts: {
    resolution: string
    watermark: boolean
    edits: ClipEditsV2
    clipStartMs: number
    clipEndMs: number
    previewKey: string
    title: string
  },
) {
  const prisma = getPrisma()
  const hash = editsVersionHash(opts.edits)
  const existing = await prisma.clipRender.findFirst({
    where: { clipId, workspaceId, status: 'READY', editsVersionHash: hash },
    orderBy: { createdAt: 'desc' },
  })
  if (existing?.outputKey) {
    const storage = getClipStorage()
    const filename = existing.filename || exportFilename(opts.title)
    return {
      render: existing,
      downloadUrl: await storage.createSignedDownloadUrl(existing.outputKey, 3600, { downloadFilename: filename }),
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
