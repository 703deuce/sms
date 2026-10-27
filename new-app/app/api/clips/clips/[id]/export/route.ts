import { NextResponse } from 'next/server'
import { z } from 'zod'
import { can } from '@/lib/billing/entitlements'
import { canReuseClipPreviewForExport } from '@/lib/clips/export-preview-reuse'
import { normalizeEdits } from '@/lib/clips/edits'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { mergeEditsPatch } from '@/lib/server/clips/clip-detail'
import { logClipEvent } from '@/lib/server/clips/events'
import { createReadyRenderFromPreview } from '@/lib/server/clips/export-preview-ready'
import { enqueueRenderClip } from '@/lib/server/clips/renders'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const resolutionSchema = z.preprocess((v) => {
  if (v === 720 || v === '720') return '720p'
  if (v === 1080 || v === '1080') return '1080p'
  return v
}, z.enum(['720p', '1080p']))

const bodySchema = z.object({
  resolution: resolutionSchema.default('720p'),
  aspect: z.enum(['9:16', '4:5', '1:1', '16:9']).default('9:16'),
  watermark: z.boolean().optional(),
  alsoSrt: z.boolean().optional(),
  /** Optional client snapshot — used when PATCH save is still in flight. */
  edits: z.record(z.unknown()).optional(),
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
    const edits = body.edits
      ? normalizeEdits(mergeEditsPatch(normalizeEdits(clip.edits, bounds), body.edits, bounds), bounds)
      : normalizeEdits(clip.edits, bounds)
    const watermark = body.watermark ?? !can(workspaceId, 'no_watermark')
    let resolution = body.resolution
    if (resolution === '1080p' && !can(workspaceId, 'export_1080p')) {
      resolution = '720p'
    }
    const aspect = body.aspect ?? edits.aspectRatio ?? '9:16'
    if (
      canReuseClipPreviewForExport({
        aspect,
        resolution,
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
        resolution,
        aspect,
        edits,
      })
      await logClipEvent(workspaceId, clip.id, 'download')
      return NextResponse.json({
        data: {
          renderId: ready.renderId,
          downloadUrl: ready.downloadUrl,
          filename: ready.filename,
          download: ready.filename,
          watermark,
          sizeBytes: ready.sizeBytes,
          projectId: clip.projectId,
          status: 'READY',
        },
      })
    }

    const result = await enqueueRenderClip(workspaceId, clipId, {
      resolution,
      aspect,
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
