import { NextResponse } from 'next/server'
import { z } from 'zod'
import { can } from '@/lib/billing/entitlements'
import {
  applyExportPlatformToEdits,
  EXPORT_PLATFORM_PRESETS,
  type ExportPlatformId,
} from '@/lib/clips/export-platform-presets'
import {
  composeResolutionForDeliver,
  DEFAULT_DELIVER,
  deliverExt,
  isDefaultDeliver,
  normalizeDeliver,
  stableDeliverJson,
  type ExportDeliver,
} from '@/lib/clips/export-deliver'
import { parseExportAspect } from '@/lib/clips/export-aspect'
import { canReuseClipPreviewForExport } from '@/lib/clips/export-preview-reuse'
import { coerceEditsForPreviewExport } from '@/lib/clips/export-edits-coerce'
import { previewExportMatchesDefault } from '@/lib/clips/export-edits-match'
import { CLIP_PREVIEW_EXPORT_ASPECT, CLIP_PREVIEW_EXPORT_RESOLUTION } from '@/lib/clips/export-preview-reuse'
import { normalizeEdits, outputDurationMs, sanitizeCutRangesForTrim } from '@/lib/clips/edits'
import { jsonError } from '@/lib/server/api-error'
import { mergeEditsPatch, getClipEditorWords } from '@/lib/server/clips/clip-detail'
import { logClipEvent } from '@/lib/server/clips/events'
import { recordStreamClipFeedback } from '@/lib/server/clips/stream-feedback'
import { createReadyRenderFromPreview } from '@/lib/server/clips/export-preview-ready'
import { enqueueRenderClip } from '@/lib/server/clips/renders'
import { applyExportPolishEdits } from '@/lib/server/clips/apply-export-polish'
import { clipBoundsForPatch } from '@/lib/server/clips/clip-patch-bounds'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import { logEditorDecision } from '@/lib/clips/editor-decision-log'
import { clipExportMediaReady } from '@/lib/clips/clip-export-media'
import { isFullVideoSettings } from '@/lib/clips/full-video'
import { captionSyncExportDecision } from '@/lib/clips/caption-sync-guard'

const resolutionSchema = z.preprocess((v) => {
  if (v === 720 || v === '720') return '720p'
  if (v === 1080 || v === '1080') return '1080p'
  return v
}, z.enum(['720p', '1080p', '1440p', '2160p']))

const bodySchema = z.object({
  resolution: resolutionSchema.default('720p'),
  aspect: z
    .string()
    .refine((v) => parseExportAspect(v) !== undefined, 'invalid aspect')
    .transform((v) => parseExportAspect(v)!)
    .default('9:16'),
  watermark: z.boolean().optional(),
  alsoSrt: z.boolean().optional(),
  /** Editor 'export anyway' acknowledgment when caption timing looks drifted. */
  captionSyncAck: z.boolean().optional(),
  removeDeadAir: z.boolean().optional(),
  /** Grid download: match preview.mp4 (layout, 9:16, no overlays, no dead-air polish). */
  previewWysiwyg: z.boolean().optional(),
  exportSfx: z.enum(['off', 'subtle', 'meme']).optional(),
  exportPlatform: z.enum(['tiktok', 'youtube_shorts', 'instagram_reels']).optional(),
  format: z.enum(['mp4', 'mov', 'gif', 'mp3', 'wav', 'm4a', 'flac', 'png']).optional(),
  codec: z.enum(['h264', 'hevc']).optional(),
  quality: z.enum(['standard', 'high', 'max']).optional(),
  fps: z.union([z.literal('source'), z.number()]).optional(),
  rangeInMs: z.number().optional(),
  rangeOutMs: z.number().optional(),
  stillAtMs: z.number().optional(),
  softSubs: z.boolean().optional(),
  stems: z.boolean().optional(),
  /** Optional client snapshot — used when PATCH save is still in flight. */
  edits: z.record(z.unknown()).optional(),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    const clip = await prisma.clip.findFirst({
      where: { id: clipId, workspaceId, deletedAt: null },
      include: {
        project: {
          select: { settings: true, proxyKey: true, upload: { select: { key: true } } },
        },
      },
    })
    if (!clip || !clipExportMediaReady(clip, clip.project)) {
      console.warn('[clipper:export] blocked missing preview', {
        clipId,
        workspaceId,
        fullVideo: isFullVideoSettings(clip?.project?.settings),
      })
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const raw = await request.text()
    const body = bodySchema.parse(raw ? JSON.parse(raw) : {})
    const bounds = await clipBoundsForPatch(clip)
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
    const watermark = can(workspaceId, 'no_watermark') ? (body.watermark ?? false) : true
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
    if ((resolution === '1440p' || resolution === '2160p') && !can(workspaceId, 'export_1080p')) {
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
    const deliverTargetRes =
      resolution === '1440p' || resolution === '2160p' ? resolution : undefined
    const hasInOut =
      body.rangeInMs != null &&
      body.rangeOutMs != null &&
      body.rangeOutMs > body.rangeInMs
    const deliver = normalizeDeliver(
      {
        format: body.format,
        codec: body.codec,
        quality: body.quality,
        fps: body.fps,
        targetResolution: deliverTargetRes,
        rangeInMs: body.rangeInMs,
        rangeOutMs: body.rangeOutMs,
        stillAtMs: body.stillAtMs,
        softSubs: body.softSubs,
        stems: body.stems,
      },
      {
        canHigh: can(workspaceId, 'export_1080p'),
        canPro: can(workspaceId, 'producer'),
        lengthMs: editedDurationMs,
        hasInOut,
        platform: Boolean(exportPlatform),
      },
    )
    const composeResolution = composeResolutionForDeliver(deliver?.targetResolution ?? resolution)
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

    const captionSync = captionSyncExportDecision({
      words: wordsPayload?.words,
      edits,
      durationMs: editedDurationMs,
      captionSyncAck: body.captionSyncAck,
      previewWysiwyg,
      format: body.format ?? deliver?.format ?? 'mp4',
    })
    if (captionSync.blocked) {
      console.info('[clipper:export] caption_sync_blocked', {
        clipId,
        workspaceId,
        codes: captionSync.warnings.map((w) => w.code),
      })
      return NextResponse.json(
        {
          error: 'Caption timing looks out of sync. Acknowledge the warning to export anyway.',
          code: 'CAPTION_SYNC_REQUIRED',
          data: { warnings: captionSync.warnings },
        },
        { status: 409 },
      )
    }

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
      !deliver &&
      clip.previewKey &&
      exportSfx === 'off' &&
      canReuseClipPreviewForExport({
        aspect,
        resolution: composeResolution,
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
      resolution: composeResolution,
      targetResolution: resolution,
      aspect,
      watermark,
      edits,
      clipStartMs: clip.startMs,
      clipEndMs: clip.endMs,
      previewKey: clip.previewKey,
      title: clip.title,
      deliver,
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
          stemsDownloadUrl: result.stemsDownloadUrl ?? null,
          stemsFilename: result.stemsFilename ?? null,
          watermark,
          projectId: clip.projectId,
          status: 'READY',
        },
      })
    }

    if (result.inFlight) {
      // FV4b: same edits already rendering — return that render (no new job, no second 'export' event).
      console.info('[clipper:export] in_flight_reused', { clipId, renderId: result.render.id, jobId: result.jobId })
      return NextResponse.json({
        data: {
          renderId: result.render.id,
          downloadUrl: null,
          filename: result.filename,
          download: result.filename,
          watermark,
          projectId: clip.projectId,
          status: result.render.status === 'RENDERING' ? 'RENDERING' : 'QUEUED',
          jobId: result.jobId,
          durationMs: editedDurationMs,
          inFlight: true,
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
