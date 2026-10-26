import { can } from '@/lib/billing/entitlements'
import { editsVersionHash, isDefaultEdits, normalizeEdits } from '@/lib/clips/edits'
import type { ExportAspect, ExportResolution } from '@/lib/clips/export-aspect'
import { renderVersionHash } from '@/lib/clips/export-aspect'
import { exportFilename } from '@/lib/server/clips/clips'
import { enqueueRenderClip } from '@/lib/server/clips/renders'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'

export async function enqueueProjectExportAll(
  workspaceId: string,
  projectId: string,
  opts: { clipIds?: string[]; aspect: ExportAspect; resolution: ExportResolution },
) {
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({ where: { id: projectId, workspaceId, deletedAt: null } })
  if (!project) throw new Error('Not found')
  const clips = await prisma.clip.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { score: 'desc' },
  })
  const selected = opts.clipIds?.length ? clips.filter((c) => opts.clipIds!.includes(c.id)) : clips
  const batch = selected.filter((c) => c.previewKey).slice(0, 10)
  if (!batch.length) throw new Error('No clips to export')

  const batchId = createId('xbatch')
  const watermark = !can(workspaceId, 'no_watermark')
  const queued: { clipId: string; renderId: string; status: string }[] = []

  for (const clip of batch) {
    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    const edits = normalizeEdits(clip.edits, bounds)
    const editsHash = editsVersionHash(edits)
    const hash = renderVersionHash(editsHash, opts.aspect, opts.resolution)
    const existing = await prisma.clipRender.findFirst({
      where: { clipId: clip.id, workspaceId, status: 'READY', editsVersionHash: hash },
    })
    if (existing?.outputKey) {
      await prisma.clipRender.update({ where: { id: existing.id }, data: { batchId } })
      queued.push({ clipId: clip.id, renderId: existing.id, status: 'READY' })
      continue
    }
    if (isDefaultEdits(edits, bounds) && clip.previewKey && opts.aspect === '9:16' && opts.resolution === '720p') {
      const renderId = createId('rnd')
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      await prisma.clipRender.create({
        data: {
          id: renderId,
          clipId: clip.id,
          workspaceId,
          status: 'READY',
          outputKey: clip.previewKey,
          watermark,
          filename: exportFilename(clip.title),
          resolution: opts.resolution,
          aspectRatio: opts.aspect,
          batchId,
          editsVersionHash: hash,
          expiresAt,
        },
      })
      queued.push({ clipId: clip.id, renderId, status: 'READY' })
      continue
    }
    const result = await enqueueRenderClip(workspaceId, clip.id, {
      resolution: opts.resolution,
      aspect: opts.aspect,
      watermark,
      edits,
      clipStartMs: clip.startMs,
      clipEndMs: clip.endMs,
      previewKey: clip.previewKey!,
      title: clip.title,
      batchId,
    })
    queued.push({
      clipId: clip.id,
      renderId: result.render.id,
      status: result.reused ? 'READY' : 'QUEUED',
    })
  }

  return { batchId, items: queued, watermark }
}
