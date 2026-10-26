import type { ClipRenderStatus } from '@prisma/client'
import { editsVersionHash, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { exportFilename } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { createId } from '@/lib/supabase/id'

const SIGNED_TTL = 3600

export async function listClipRenders(workspaceId: string, statusFilter?: 'all' | 'ready' | 'failed') {
  const prisma = getPrisma()
  const where: Record<string, unknown> = { workspaceId }
  if (statusFilter === 'ready') where.status = 'READY'
  if (statusFilter === 'failed') where.status = 'FAILED'
  const rows = await prisma.clipRender.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      clip: {
        select: {
          id: true,
          title: true,
          projectId: true,
          posterKey: true,
          previewKey: true,
        },
      },
    },
  })
  const storage = getClipStorage()
  return Promise.all(
    rows.map(async (r) => {
      const fname = r.filename || exportFilename(r.clip.title)
      return {
        id: r.id,
        clipId: r.clipId,
        projectId: r.clip.projectId,
        title: r.clip.title,
        resolution: r.resolution,
        watermark: r.watermark,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        expiresAt: r.expiresAt?.toISOString() ?? null,
        sizeBytes: r.sizeBytes ? Number(r.sizeBytes) : null,
        filename: fname,
        posterUrl: r.clip.posterKey ? await storage.createSignedDownloadUrl(r.clip.posterKey, SIGNED_TTL) : null,
        editorUrl: `/app/clips/${r.clip.projectId}/edit/${r.clipId}`,
        downloadUrl:
          r.status === 'READY' && r.outputKey
            ? await storage.createSignedDownloadUrl(r.outputKey, SIGNED_TTL, { downloadFilename: fname })
            : null,
      }
    }),
  )
}

export async function getRenderForWorkspace(workspaceId: string, renderId: string) {
  const prisma = getPrisma()
  return prisma.clipRender.findFirst({ where: { id: renderId, workspaceId } })
}

export async function enqueueRenderClip(
  workspaceId: string,
  clipId: string,
  opts: { resolution: string; watermark: boolean; edits: ClipEditsV2; clipDurationMs: number; previewKey: string; title: string },
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
