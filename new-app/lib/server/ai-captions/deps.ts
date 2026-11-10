import 'server-only'

import { normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { sourceAspectRatio } from '@/lib/clips/full-video'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { CLIPS_EDITOR_MEDIA_TTL_SEC, createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import { writeClipEditsOrThrow } from '@/lib/server/clips/write-clip-edits'
import { loadProjectSourceWords } from '@/lib/server/clips/transcript'
import { enqueueRenderClip, getRenderForWorkspace } from '@/lib/server/clips/renders'
import type { AiCaptionsPipelineDeps, ResolvedCaptionsSource } from '@/lib/ai-captions/pipeline'
import type { AiCaptionsPrefs, AiCaptionsRunRecord, AiCaptionsRunStore } from '@/lib/ai-captions/run-store'
import type { SavedCaptionStyle } from '@/lib/ai-captions/styles'
import type { AiCaptionsRunDeps } from '@/lib/ai-captions/runs'
import type { AiCaptionsSource, TranscriptWord } from '@/lib/ai-captions/types'
import { AiCaptionsError } from '@/lib/ai-captions/errors'
import { createCaptionsOnlyProject } from '@/lib/server/ai-captions/create-project'

type PrismaClient = ReturnType<typeof getPrisma>

function asWords(raw: unknown): TranscriptWord[] | null {
  if (!Array.isArray(raw) || !raw.length) return null
  const words: TranscriptWord[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const rec = row as Record<string, unknown>
    const w = typeof rec.w === 'string' ? rec.w : typeof rec.text === 'string' ? rec.text : ''
    const s = Number(rec.s ?? rec.start ?? rec.startMs)
    const e = Number(rec.e ?? rec.end ?? rec.endMs)
    if (!w || !Number.isFinite(s) || !Number.isFinite(e)) continue
    const start = s > 1000 && e > 1000 && s > 10 ? s / 1000 : s
    const end = s > 1000 && e > 1000 && e > 10 ? e / 1000 : e
    const p = typeof rec.p === 'number' ? rec.p : typeof rec.confidence === 'number' ? rec.confidence : undefined
    words.push({ w, s: start, e: end, ...(p !== undefined ? { p } : {}) })
  }
  return words.length ? words : null
}

function recordFromRow(row: {
  id: string
  workspaceId: string
  status: string
  stage: string | null
  progressPercent: number | null
  failureCode: string | null
  failureMessage: string | null
  clientRequestId: string
  requestHash: string
  source: unknown
  ingestedProjectId: string | null
  styleId: string | null
  creditEstimate: number | null
  result: unknown
  createdById: string | null
  createdAt: Date
  updatedAt: Date
}): AiCaptionsRunRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    status: row.status as AiCaptionsRunRecord['status'],
    stage: row.stage as AiCaptionsRunRecord['stage'],
    progressPercent: row.progressPercent,
    failureCode: row.failureCode,
    failureMessage: row.failureMessage,
    clientRequestId: row.clientRequestId,
    requestHash: row.requestHash,
    source: row.source as AiCaptionsSource,
    ingestedProjectId: row.ingestedProjectId,
    styleId: row.styleId,
    creditEstimate: row.creditEstimate,
    result: row.result as AiCaptionsRunRecord['result'],
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function prismaAiCaptionsStore(prisma: PrismaClient = getPrisma()): AiCaptionsRunStore {
  return {
    async create(record) {
      const row = await prisma.aiCaptionsRun.create({
        data: {
          id: record.id,
          workspaceId: record.workspaceId,
          status: record.status,
          stage: record.stage,
          progressPercent: record.progressPercent,
          failureCode: record.failureCode,
          failureMessage: record.failureMessage,
          clientRequestId: record.clientRequestId,
          requestHash: record.requestHash,
          source: record.source as object,
          ingestedProjectId: record.ingestedProjectId,
          styleId: record.styleId,
          creditEstimate: record.creditEstimate,
          result: record.result ? (record.result as object) : undefined,
          createdById: record.createdById,
        },
      })
      return recordFromRow(row)
    },
    async get(workspaceId, id) {
      const row = await prisma.aiCaptionsRun.findFirst({ where: { id, workspaceId } })
      return row ? recordFromRow(row) : null
    },
    async getByClientRequestId(workspaceId, clientRequestId) {
      const row = await prisma.aiCaptionsRun.findFirst({ where: { workspaceId, clientRequestId } })
      return row ? recordFromRow(row) : null
    },
    async list(workspaceId, limit = 40) {
      console.info('[ai-captions:store] list_begin', { workspaceId, limit })
      const rows = await prisma.aiCaptionsRun.findMany({
        where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: Math.min(100, Math.max(1, limit)),
      })
      console.info('[ai-captions:store] list_complete', { workspaceId, count: rows.length })
      return rows.map(recordFromRow)
    },
    async update(workspaceId, id, patch) {
      const data: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(patch)) {
        if (k === 'id' || k === 'workspaceId' || k === 'createdAt' || k === 'updatedAt') continue
        data[k] = v
      }
      const row = await prisma.aiCaptionsRun.update({ where: { id }, data })
      if (row.workspaceId !== workspaceId) throw new Error('ai_captions_run_missing')
      return recordFromRow(row)
    },
  }
}

export function prismaAiCaptionsPrefs(prisma: PrismaClient = getPrisma()): AiCaptionsPrefs {
  return {
    async getLastStyleId(workspaceId) {
      const row = await prisma.aiCaptionsWorkspacePref.findUnique({ where: { workspaceId } })
      return row?.lastStyleId ?? null
    },
    async setLastStyleId(workspaceId, styleId) {
      await prisma.aiCaptionsWorkspacePref.upsert({
        where: { workspaceId },
        create: { workspaceId, lastStyleId: styleId },
        update: { lastStyleId: styleId },
      })
    },
  }
}

async function resolveSource(
  workspaceId: string,
  source: AiCaptionsSource,
  ingestedProjectId?: string | null,
): Promise<ResolvedCaptionsSource | null> {
  const prisma = getPrisma()
  const projectId =
    source.kind === 'upload' ? ingestedProjectId : source.projectId
  if (!projectId) return null
  const project = await prisma.clipProject.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
    include: { upload: { select: { durationMs: true, key: true } } },
  })
  if (!project) return null
  console.info('[ai-captions:source] resolved_project', { projectId, status: project.status, stage: project.stage, progress: project.progress })
  if (String(project.status) === 'FAILED' || String(project.status) === 'CANCELED') {
    throw new AiCaptionsError('source_processing_failed', 'Video transcription could not finish. Please retry or upload another video.', 409)
  }
  const ready = String(project.status) === 'READY'
  let durationMs = Math.max(0, (project.rangeEndMs ?? 0) - (project.rangeStartMs ?? 0))
  let hasAudio = true
  let words = asWords(project.transcriptWords)
  let assetId: string | undefined

  if (source.kind === 'asset') {
    assetId = source.assetId
    const media = await prisma.clipProjectMedia.findFirst({
      where: {
        projectId: project.id,
        workspaceId,
        OR: [{ id: source.assetId }, { uploadId: source.assetId }],
      },
      include: { upload: { select: { durationMs: true } } },
    })
    if (!media) return null
    if (media.hasAudio === false) hasAudio = false
    durationMs = media.durationMs ?? media.upload?.durationMs ?? durationMs
    const mediaTx = await prisma.clipMediaTranscript.findFirst({
      where: { projectId: project.id, workspaceId, refId: media.uploadId, status: 'done' },
      select: { words: true, durationMs: true },
    })
    if (mediaTx?.words) words = asWords(mediaTx.words) ?? words
    if (mediaTx?.durationMs) durationMs = mediaTx.durationMs
  }

  if (!words) {
    try {
      const loaded = await loadProjectSourceWords(project.id)
      if (loaded.length) {
        words = loaded.map((w) => ({ w: w.w, s: w.s, e: w.e, ...(typeof w.p === 'number' ? { p: w.p } : {}) }))
      }
    } catch {
      /* keep null */
    }
  }

  if (!durationMs && words?.length) durationMs = Math.round(words[words.length - 1]!.e * 1000)
  if (!durationMs && project.upload?.durationMs) durationMs = project.upload.durationMs

  const storage = getClipStorage()
  const mediaKey = project.proxyKey || project.upload?.key
  const [playbackUrl, thumbnailUrl] = await Promise.all([
    mediaKey ? createCachedSignedDownloadUrl(storage, mediaKey, { versionHint: `captions:media:${project.id}` }, CLIPS_EDITOR_MEDIA_TTL_SEC).catch((err) => {
      console.warn('[ai-captions:source] media_sign_failed', { projectId, error: String(err) }); return null
    }) : Promise.resolve(null),
    project.thumbKey ? createCachedSignedDownloadUrl(storage, project.thumbKey, { versionHint: `captions:thumb:${project.id}` }, CLIPS_EDITOR_MEDIA_TTL_SEC).catch((err) => {
      console.warn('[ai-captions:source] thumb_sign_failed', { projectId, error: String(err) }); return null
    }) : Promise.resolve(null),
  ])
  console.info('[ai-captions:source] resolved_media', { projectId, playback: Boolean(playbackUrl), thumbnail: Boolean(thumbnailUrl), words: words?.length ?? 0 })
  return { projectId: project.id, assetId, durationMs, ready, hasAudio, words, playbackUrl, thumbnailUrl }
}

const productionPipeline = (): AiCaptionsPipelineDeps => ({
  ingestUpload: (workspaceId, uploadId, createdById) =>
    createCaptionsOnlyProject(workspaceId, uploadId, createdById),
  resolveSource,
  async transcribe() {
    // Production GET will poll again until an existing transcript appears.
    // Tests inject a transcribe mock and never use this path. No paid provider calls here.
    return []
  },
  async writeClip(args) {
    const prisma = getPrisma()
    const clipId = createId('clip')
    console.info('[ai-captions:clip] create_begin', { projectId: args.projectId, runId: args.runId })
    const project = await prisma.clipProject.findFirst({ where: { id: args.projectId, workspaceId: args.workspaceId }, include: { upload: { select: { width: true, height: true } } } })
    const aspectRatio = sourceAspectRatio(project?.upload?.width, project?.upload?.height)
    await prisma.clip.create({
      data: {
        id: clipId,
        projectId: args.projectId,
        workspaceId: args.workspaceId,
        title: args.title,
        reason: 'ai_captions',
        startMs: 0,
        endMs: args.durationMs,
        edits: toPrismaJson({ ...args.edits, aspectRatio }),
        editsSaveVersion: 1,
        aiMeta: { aiCaptionsRunId: args.runId, aiOriginalEdits: args.edits },
        score: 0,
        scores: {},
      },
    })
    console.info('[ai-captions:clip] create_complete', { clipId, aspectRatio })
    return { clipId, projectId: args.projectId, editsSaveVersion: 1 }
  },
  async updateClipEdits(args) {
    const prisma = getPrisma()
    const clip = await prisma.clip.findUniqueOrThrow({
      where: { id: args.clipId },
      select: { projectId: true, editsSaveVersion: true },
    })
    const previous = await prisma.clip.findUniqueOrThrow({ where: { id: args.clipId }, select: { edits: true } })
    const current = normalizeEdits(previous.edits, args.bounds)
    const merged: ClipEditsV2 = {
      ...current,
      captions: { ...current.captions, ...args.edits.captions },
      captionLines: current.captionLines?.length ? current.captionLines : args.edits.captionLines,
    }
    console.info('[ai-captions:style] preserving_existing_clip_edits', { clipId: args.clipId, version: clip.editsSaveVersion })
    const res = await writeClipEditsOrThrow(args.clipId, args.bounds, clip.editsSaveVersion, () => merged)
    return { clipId: args.clipId, projectId: clip.projectId, editsSaveVersion: res.editsSaveVersion }
  },
  async exportMp4(args) {
    const prisma = getPrisma()
    const clip = await prisma.clip.findFirst({
      where: { id: args.clipId, workspaceId: args.workspaceId, deletedAt: null },
    })
    if (!clip) throw new AiCaptionsError('export_not_ready', 'The caption clip was not found.', 409)
    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    const edits = normalizeEdits(clip.edits, bounds)
    const queued = await enqueueRenderClip(args.workspaceId, args.clipId, {
      resolution: '1080p',
      aspect: edits.aspectRatio || '16:9',
      watermark: false,
      edits,
      clipStartMs: clip.startMs,
      clipEndMs: clip.endMs,
      previewKey: clip.previewKey,
      title: clip.title,
    })
    console.info('[ai-captions:export] enqueued', { clipId: args.clipId, renderId: queued.render.id, cached: Boolean(queued.downloadUrl) })
    return { downloadUrl: queued.downloadUrl, renderId: queued.render.id }
  },
  async pollExport(workspaceId, renderId) {
    console.info('[ai-captions:export] poll_begin', { workspaceId, renderId })
    const render = await getRenderForWorkspace(workspaceId, renderId)
    if (!render) return { status: 'failed', downloadUrl: null, error: 'The export could not be found. Please retry.' }
    if (render.status === 'FAILED') return { status: 'failed', downloadUrl: null, error: 'The video could not be exported. Please retry.' }
    if (render.status !== 'READY' || !render.outputKey) return { status: 'processing', downloadUrl: null }
    const downloadUrl = await createCachedSignedDownloadUrl(getClipStorage(), render.outputKey, {
      downloadFilename: render.filename || 'captions.mp4',
      versionHint: `render:${renderId}`,
    })
    console.info('[ai-captions:export] poll_ready', { renderId })
    return { status: 'ready', downloadUrl }
  },
  async getCaptionLines(workspaceId, clipId) {
    console.info('[ai-captions:subtitles] load_clip_lines', { workspaceId, clipId })
    const clip = await getPrisma().clip.findFirst({ where: { id: clipId, workspaceId, deletedAt: null }, select: { edits: true, startMs: true, endMs: true } })
    if (!clip) throw new AiCaptionsError('run_not_found', 'The caption clip was not found.', 404)
    const edits = normalizeEdits(clip.edits, { clipStartMs: clip.startMs, clipEndMs: clip.endMs })
    return (edits.captionLines ?? []).map(line => ({ id: line.id, text: line.text, startMs: line.startMs, endMs: line.endMs }))
  },
  async listSavedStyles(workspaceId): Promise<SavedCaptionStyle[]> {
    const prisma = getPrisma()
    const rows = await prisma.captionPreset.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return rows.map((row) => ({
      styleId: row.id,
      name: row.name,
      basePresetId: row.basePresetId,
      config: (row.config ?? {}) as Record<string, unknown>,
    }))
  },
})

export function productionRunDeps(): AiCaptionsRunDeps {
  return {
    store: prismaAiCaptionsStore(),
    prefs: prismaAiCaptionsPrefs(),
    pipeline: productionPipeline(),
  }
}

