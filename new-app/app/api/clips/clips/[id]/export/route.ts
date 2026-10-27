import { NextResponse } from 'next/server'
import { z } from 'zod'
import { can } from '@/lib/billing/entitlements'
import {
  applyExportPlatformToEdits,
  EXPORT_PLATFORM_PRESETS,
  type ExportPlatformId,
} from '@/lib/clips/export-platform-presets'
import { canReuseClipPreviewForExport } from '@/lib/clips/export-preview-reuse'
import { normalizeEdits } from '@/lib/clips/edits'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { mergeEditsPatch } from '@/lib/server/clips/clip-detail'
import { logClipEvent } from '@/lib/server/clips/events'
import { recordStreamClipFeedback } from '@/lib/server/clips/stream-feedback'
import { createReadyRenderFromPreview } from '@/lib/server/clips/export-preview-ready'
import { enqueueRenderClip } from '@/lib/server/clips/renders'
import { applyExportPolishEdits } from '@/lib/server/clips/apply-export-polish'
import { getClipEditorWords } from '@/lib/server/clips/clip-detail'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getPrisma } from '@/lib/server/db'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'

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
  removeDeadAir: z.boolean().optional(),
  exportSfx: z.enum(['off', 'subtle', 'meme']).optional(),
  exportPlatform: z.enum(['tiktok', 'youtube_shorts', 'instagram_reels']).optional(),
  /** Optional client snapshot — used when PATCH save is still in flight. */
  edits: z.record(z.unknown()).optional(),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip?.previewKey) {
      console.warn('[clipper:export] blocked missing preview', { clipId, workspaceId })
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const raw = await request.text()
    const body = bodySchema.parse(raw ? JSON.parse(raw) : {})
    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    let edits = body.edits
      ? normalizeEdits(mergeEditsPatch(normalizeEdits(clip.edits, bounds), body.edits, bounds), bounds)
      : normalizeEdits(clip.edits, bounds)
    const exportPlatform = body.exportPlatform as ExportPlatformId | undefined
    if (exportPlatform) {
      edits = applyExportPlatformToEdits(edits, exportPlatform)
    }
    const wordsPayload = await getClipEditorWords(workspaceId, clipId)
    const hookText =
      typeof clip.aiMeta === 'object' && clip.aiMeta && 'hook' in clip.aiMeta
        ? String((clip.aiMeta as { hook?: string }).hook ?? '')
        : edits.hookOverlay?.text ?? null
    edits = applyExportPolishEdits(edits, {
      exportPlatform: exportPlatform ?? null,
      streamClip: false,
      words: wordsPayload?.words,
      removeDeadAir: body.removeDeadAir ?? true,
      hookText,
      exportSfx: body.exportSfx ?? 'off',
    })
    const watermark = body.watermark ?? !can(workspaceId, 'no_watermark')
    let resolution = body.resolution
    if (exportPlatform) {
      const platformPreset = EXPORT_PLATFORM_PRESETS[exportPlatform]
      if (platformPreset.resolution === '1080p' && can(workspaceId, 'export_1080p')) {
        resolution = '1080p'
      } else if (platformPreset.resolution === '1080p') {
        resolution = '720p'
      }
    }
    if (resolution === '1080p' && !can(workspaceId, 'export_1080p')) {
      resolution = '720p'
    }
    const aspect = exportPlatform
      ? edits.aspectRatio ?? '9:16'
      : body.aspect ?? edits.aspectRatio ?? '9:16'
    const exportSfx = body.exportSfx ?? 'off'
    console.info('[clipper:export] request', {
      clipId,
      workspaceId,
      resolution,
      aspect,
      exportPlatform: exportPlatform ?? null,
      watermark,
      durationMs: clip.endMs - clip.startMs,
      exportSfx,
    })

    const prisma = getPrisma()
    await prisma.clip.update({
      where: { id: clipId },
      data: { edits: toPrismaJson(edits) },
    })

    if (
      exportSfx === 'off' &&
      canReuseClipPreviewForExport({
        aspect,
        resolution,
        edits,
        bounds,
      })
    ) {
      console.info('[clipper:export] preview_reuse', { clipId, renderId: 'pending' })
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
      await recordStreamClipFeedback(workspaceId, clip.id, 'download').catch(() => {})
      console.info('[clipper:export] ready_reuse', {
        clipId,
        renderId: ready.renderId,
        filename: ready.filename,
        durationMs: clip.endMs - clip.startMs,
      })
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
      await recordStreamClipFeedback(workspaceId, clip.id, 'download').catch(() => {})
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

    await logClipEvent(workspaceId, clip.id, 'export')
    await recordStreamClipFeedback(workspaceId, clip.id, 'export').catch(() => {})
    console.info('[clipper:export] enqueued', {
      clipId,
      renderId: result.render.id,
      jobId: result.jobId,
      filename: result.filename,
      reused: false,
    })
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
        durationMs: clip.endMs - clip.startMs,
      },
    })
  } catch (err) {
    console.error('[clipper:export] failed', {
      message: err instanceof Error ? err.message : String(err),
    })
    return jsonError(err, 400)
  }
}
