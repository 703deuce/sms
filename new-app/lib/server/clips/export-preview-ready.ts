import { editsVersionHash, type ClipEditsV2 } from '@/lib/clips/edits'
import type { ExportAspect, ExportResolution } from '@/lib/clips/export-aspect'
import { exportFilename } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'
import { createId } from '@/lib/supabase/id'

export async function createReadyRenderFromPreview(opts: {
  workspaceId: string
  clipId: string
  previewKey: string
  title: string
  watermark: boolean
  resolution: ExportResolution
  aspect: ExportAspect
  edits: ClipEditsV2
  batchId?: string | null
}) {
  const prisma = getPrisma()
  const storage = getClipStorage()
  const renderId = createId('rnd')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const filename = exportFilename(opts.title)
  const hash = editsVersionHash(opts.edits)
  const sizeBytes = await storage.getObjectSizeBytes(opts.previewKey)

  await prisma.clipRender.create({
    data: {
      id: renderId,
      clipId: opts.clipId,
      workspaceId: opts.workspaceId,
      status: 'READY',
      outputKey: opts.previewKey,
      watermark: opts.watermark,
      filename,
      resolution: opts.resolution,
      aspectRatio: opts.aspect,
      batchId: opts.batchId ?? null,
      editsVersionHash: hash,
      expiresAt,
      sizeBytes: sizeBytes ? BigInt(sizeBytes) : null,
    },
  })

  const downloadUrl = await createCachedSignedDownloadUrl(storage, opts.previewKey, {
    downloadFilename: filename,
  })

  return { renderId, filename, downloadUrl, sizeBytes }
}
