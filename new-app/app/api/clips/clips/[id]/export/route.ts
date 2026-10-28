import { NextResponse } from 'next/server'
import { z } from 'zod'
import { can } from '@/lib/billing/entitlements'
import {
  applyExportPlatformToEdits,
  EXPORT_PLATFORM_PRESETS,
  type ExportPlatformId,
} from '@/lib/clips/export-platform-presets'
import { canReuseClipPreviewForExport } from '@/lib/clips/export-preview-reuse'
import { coerceEditsForPreviewExport } from '@/lib/clips/export-edits-coerce'
import { previewExportMatchesDefault } from '@/lib/clips/export-edits-match'
import { CLIP_PREVIEW_EXPORT_ASPECT, CLIP_PREVIEW_EXPORT_RESOLUTION } from '@/lib/clips/export-preview-reuse'
import { normalizeEdits, outputDurationMs, sanitizeCutRangesForTrim } from '@/lib/clips/edits'
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
import { logEditorDecision } from '@/lib/clips/editor-decision-log'

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
  /** Grid download: match preview.mp4 (layout, 9:16, no overlays, no dead-air polish). */
  previewWysiwyg: z.boolean().optional(),
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
    const exportSfx = body.exportSfx ?? 'off'
    const removeDeadAir = body.removeDeadAir ?? false
    const previewWysiwyg = body.previewWysiwyg === true
    if (previewWysiwyg && !body.edits && !body.exportPlatform && exportSfx === 'off') {
      edits = coerceEditsForPreviewExport(edits, clip.aiMeta, bounds)
    }
    const editsBeforePolish = edits
    const defaultPreviewExport =
      !exportPlatform &&
      exportSfx === 'off' &&
      previewExportMatchesDefault(editsBeforePolish, bounds)
    const skipPolishForPreviewReuse =
      defaultPreviewExport && removeDeadAir === false && !body.edits

    const wordsPayload = await getClipEditorWords(workspaceId, clipId)
    const hookText =
      typeof clip.aiMeta === 'object' && clip.aiMeta && 'hook' in clip.aiMeta
        ? String((clip.aiMeta as { hook?: string }).hook ?? '')
        : edits.hookOverlay?.text ?? null
    if (!skipPolishForPreviewReuse) {
      edits = applyExportPolishEdits(edits, {
        exportPlatform: exportPlatform ?? null,
        streamClip: false,
        words: wordsPayload?.words,
        removeDeadAir,
        hookText,
        exportSfx,
      })
    }
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
      : previewWysiwyg
        ? CLIP_PREVIEW_EXPORT_ASPECT
        : body.aspect ?? edits.aspectRatio ?? '9:16'
    if (previewWysiwyg && !exportPlatform) {
      resolution = CLIP_PREVIEW_EXPORT_RESOLUTION
    }
    const editedDurationMs = outputDurationMs(edits)
    logEditorDecision('export_request', {
      clipId,
      workspaceId,
      resolution,
      aspect,
      exportPlatform: exportPlatform ?? null,
      watermark,
      durationMs: editedDurationMs,
      sourceSpanMs: clip.endMs - clip.startMs,
      exportSfx,
      removeDeadAir,
      previewWysiwyg,
      cutCount: edits.cutRanges.length,
    })
    console.info('[clipper:export] request', {
      clipId,
      workspaceId,
      resolution,
      aspect,
      exportPlatform: exportPlatform ?? null,
      watermark,
      durationMs: editedDurationMs,
      sourceSpanMs: clip.endMs - clip.startMs,
      exportSfx,
      skipPolishForPreviewReuse,
    })

    const prisma = getPrisma()
    if (!skipPolishForPreviewReuse) {
      edits = {
        ...edits,
        cutRanges: sanitizeCutRangesForTrim(edits.cutRanges, edits.trim.in, edits.trim.out),
      }
      await prisma.clip.update({
        where: { id: clipId },
        data: { edits: toPrismaJson(edits) },
      })
    }

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
        durationMs: editedDurationMs,
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
          durationMs: editedDurationMs,
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
        durationMs: editedDurationMs,
      },
    })
  } catch (err) {
    console.error('[clipper:export] failed', {
      message: err instanceof Error ? err.message : String(err),
    })
    return jsonError(err, 400)
  }
}
