import { NextResponse } from 'next/server'
import { z } from 'zod'
import { can } from '@/lib/billing/entitlements'
import { isDefaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { jsonError } from '@/lib/server/api-error'
import { exportFilename, getClipForWorkspace } from '@/lib/server/clips/clips'
import { logClipEvent } from '@/lib/server/clips/events'
import { enqueueRenderClip } from '@/lib/server/clips/renders'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { createId } from '@/lib/supabase/id'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.object({
  resolution: z.union([z.literal(720), z.literal('720p')]).optional(),
  watermark: z.boolean().optional(),
  alsoSrt: z.boolean().optional(),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip?.previewKey) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const raw = await request.text()
    const body = bodySchema.parse(raw ? JSON.parse(raw) : {})
    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    const edits = normalizeEdits(clip.edits, bounds)
    const watermark = body.watermark ?? !can(workspaceId, 'no_watermark')
    const resolution = '720p'
    const filename = exportFilename(clip.title)
    const storage = getClipStorage()
    const prisma = getPrisma()

    if (isDefaultEdits(edits, bounds)) {
      const renderId = createId('rnd')
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const sizeBytes = await storage.getObjectSizeBytes(clip.previewKey)
      const { editsVersionHash } = await import('@/lib/clips/edits')
      const hash = editsVersionHash(edits)
      await prisma.clipRender.create({
        data: {
          id: renderId,
          clipId: clip.id,
          workspaceId,
          status: 'READY',
          outputKey: clip.previewKey,
          watermark,
          filename,
          resolution,
          editsVersionHash: hash,
          expiresAt,
          sizeBytes: sizeBytes ? BigInt(sizeBytes) : null,
        },
      })
      await logClipEvent(workspaceId, clip.id, 'download')
      const url = await storage.createSignedDownloadUrl(clip.previewKey, 3600, { downloadFilename: filename })
      return NextResponse.json({
        data: {
          renderId,
          downloadUrl: url,
          filename,
          download: filename,
          watermark,
          sizeBytes,
          projectId: clip.projectId,
          status: 'READY',
        },
      })
    }

    const result = await enqueueRenderClip(workspaceId, clipId, {
      resolution,
      watermark,
      edits,
      clipStartMs: clip.startMs,
      clipEndMs: clip.endMs,
      previewKey: clip.previewKey,
      title: clip.title,
    })

    if (result.reused && result.downloadUrl) {
      await logClipEvent(workspaceId, clip.id, 'download')
      return NextResponse.json({
        data: {
          renderId: result.render.id,
          downloadUrl: result.downloadUrl,
          filename: result.filename,
          download: result.filename,
          watermark,
          projectId: clip.projectId,
          status: 'READY',
        },
      })
    }

    await logClipEvent(workspaceId, clip.id, 'download')
    return NextResponse.json({
      data: {
        renderId: result.render.id,
        downloadUrl: null,
        filename: result.filename,
        download: result.filename,
        watermark,
        projectId: clip.projectId,
        status: 'QUEUED',
        jobId: result.jobId,
      },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}
