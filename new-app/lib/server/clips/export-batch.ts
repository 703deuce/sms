import { can } from '@/lib/billing/entitlements'
import { canReuseClipPreviewForExport } from '@/lib/clips/export-preview-reuse'
import { normalizeExportTemplate } from '@/lib/clips/export-template'
import { editsVersionHash, normalizeEdits } from '@/lib/clips/edits'
import { mergeEditsPatch } from '@/lib/server/clips/clip-detail'
import type { ExportAspect, ExportResolution } from '@/lib/clips/export-aspect'
import { renderVersionHash } from '@/lib/clips/export-aspect'
import { createReadyRenderFromPreview } from '@/lib/server/clips/export-preview-ready'
import { enqueueRenderClip } from '@/lib/server/clips/renders'
import { getPrisma } from '@/lib/server/db'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import { createId } from '@/lib/supabase/id'

export async function enqueueProjectExportAll(
  workspaceId: string,
  projectId: string,
  opts: {
    clipIds?: string[]
    aspect: ExportAspect
    resolution: ExportResolution
    clipExportTemplates?: Record<string, Record<string, unknown>>
  },
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
    let edits = normalizeEdits(clip.edits, bounds)
    const tplPatch = opts.clipExportTemplates?.[clip.id]
    if (tplPatch) {
      const tpl = normalizeExportTemplate(tplPatch)
      if (tpl) {
        edits = normalizeEdits(mergeEditsPatch(edits, { exportTemplate: tpl }, bounds), bounds)
        await prisma.clip.update({ where: { id: clip.id }, data: { edits: toPrismaJson(edits) } })
      }
    }
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
    if (
      clip.previewKey &&
      canReuseClipPreviewForExport({
        aspect: opts.aspect,
        resolution: opts.resolution,
        edits,
        bounds,
      })
    ) {
      const ready = await createReadyRenderFromPreview({
        workspaceId,
        clipId: clip.id,
        previewKey: clip.previewKey,
        title: clip.title,
        watermark,
        resolution: opts.resolution,
        aspect: opts.aspect,
        edits,
        batchId,
      })
      queued.push({ clipId: clip.id, renderId: ready.renderId, status: 'READY' })
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
