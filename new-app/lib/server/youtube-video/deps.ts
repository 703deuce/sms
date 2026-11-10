import 'server-only'

import { defaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { writeClipEditsOrThrow } from '@/lib/server/clips/write-clip-edits'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import { createAiProducerOutputProject } from '@/lib/server/ai-producer-agent/create-output-project'
import { enqueueRenderClip } from '@/lib/server/clips/renders'
import { getClipStorage } from '@/lib/storage'
import { createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'
import { buildYoutubeStoryEditAssembly } from '@/lib/youtube-video/story-edit-assembly'
import { advanceYoutubeSharedStory } from '@/lib/youtube-video/shared-pipeline'
import { traceYoutubeRunStep, youtubeRunEvent } from '@/lib/youtube-video/step-log'
import { storyCutsInEditorialOrder } from '@/lib/youtube-video/assemble'
import { cutsFromOption } from '@/lib/youtube-video/story-options'
import { memoryYoutubeVideoStore, type YoutubeVideoRunRecord, type YoutubeVideoRunStore } from '@/lib/youtube-video/run-store'
import { defaultStreamerImporter } from '@/lib/youtube-video/import-source'
import { YoutubeVideoError } from '@/lib/youtube-video/errors'
import type { YoutubeVideoPipelineDeps, WriteYoutubeClip } from '@/lib/youtube-video/pipeline'
import type { RevertClip, YoutubeVideoRunDeps } from '@/lib/youtube-video/runs'
import type { YoutubeVideoIngestedSource } from '@/lib/youtube-video/types'

const ACTIVE_STATUSES = ['queued', 'importing', 'waiting_for_source', 'running', 'awaiting_choice']

function fromRow(row: Record<string, unknown>): YoutubeVideoRunRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspaceId),
    status: row.status as YoutubeVideoRunRecord['status'],
    stage: (row.stage ?? null) as YoutubeVideoRunRecord['stage'],
    progressPercent: (row.progressPercent ?? null) as number | null,
    failureCode: (row.failureCode ?? null) as string | null,
    failureMessage: (row.failureMessage ?? null) as string | null,
    instruction: (row.instruction ?? null) as string | null,
    clientRequestId: String(row.clientRequestId),
    requestHash: String(row.requestHash),
    sources: (row.sources ?? []) as YoutubeVideoRunRecord['sources'],
    ingested: (row.ingested ?? []) as YoutubeVideoRunRecord['ingested'],
    analysisState: (row.analysisState ?? null) as YoutubeVideoRunRecord['analysisState'],
    options: (row.options ?? null) as YoutubeVideoRunRecord['options'],
    chosenOptionId: (row.chosenOptionId ?? null) as string | null,
    creditsEstimated: (row.creditsEstimated ?? null) as number | null,
    result: (row.result ?? null) as YoutubeVideoRunRecord['result'],
    createdById: (row.createdById ?? null) as string | null,
    createdAt: new Date(row.createdAt as string | Date).toISOString(),
    updatedAt: new Date(row.updatedAt as string | Date).toISOString(),
  }
}

function toData(patch: Partial<YoutubeVideoRunRecord>) {
  const data: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'createdAt' || key === 'updatedAt') continue
    if (['sources', 'ingested', 'analysisState', 'options', 'result'].includes(key)) {
      data[key] = value == null ? (key === 'sources' || key === 'ingested' ? [] : null) : toPrismaJson(value)
    } else {
      data[key] = value
    }
  }
  return data
}

export function prismaYoutubeVideoStore(): YoutubeVideoRunStore {
  const db = () => getPrisma().youtubeVideoRun
  return {
    async create(record) {
      const row = await db().create({ data: { ...toData(record), id: record.id } as never })
      return fromRow(row as unknown as Record<string, unknown>)
    },
    async get(workspaceId, id) {
      const row = await db().findFirst({ where: { id, workspaceId } })
      return row ? fromRow(row as unknown as Record<string, unknown>) : null
    },
    async getByClientRequestId(workspaceId, clientRequestId) {
      const row = await db().findUnique({ where: { workspaceId_clientRequestId: { workspaceId, clientRequestId } } })
      return row ? fromRow(row as unknown as Record<string, unknown>) : null
    },
    async findActive(workspaceId) {
      const row = await db().findFirst({ where: { workspaceId, status: { in: ACTIVE_STATUSES } } })
      return row ? fromRow(row as unknown as Record<string, unknown>) : null
    },
    async claimPlanning(workspaceId, id, staleBeforeIso) {
      const claimed = await db().updateMany({
        where: {
          id, workspaceId,
          OR: [
            { status: 'waiting_for_source' },
            { status: 'queued' },
            { status: 'running', stage: 'planning', updatedAt: { lt: new Date(staleBeforeIso) } },
          ],
        },
        data: { status: 'running', stage: 'planning', progressPercent: 50 },
      })
      return claimed.count === 1
    },
    async heartbeatPlanning(workspaceId, id) {
      const updated = await db().updateMany({
        where: { id, workspaceId, status: 'running', stage: 'planning' },
        data: { updatedAt: new Date() },
      })
      return updated.count === 1
    },
    async update(workspaceId, id, patch) {
      const existing = await db().findFirst({ where: { id, workspaceId }, select: { id: true } })
      if (!existing) throw new Error('youtube_video_run_missing')
      const row = await db().update({ where: { id }, data: toData(patch) as never })
      return fromRow(row as unknown as Record<string, unknown>)
    },
  }
}

let memorySingleton: YoutubeVideoRunStore | undefined

export function getYoutubeVideoStore(): YoutubeVideoRunStore {
  if (process.env.YOUTUBE_VIDEO_MEMORY_STORE === '1') {
    memorySingleton ??= memoryYoutubeVideoStore()
    return memorySingleton
  }
  return prismaYoutubeVideoStore()
}

export async function loadReadySource(workspaceId: string, projectId: string): Promise<YoutubeVideoIngestedSource> {
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
    select: {
      status: true,
      id: true,
      title: true,
      rangeStartMs: true,
      rangeEndMs: true,
      transcriptWords: true,
      upload: { select: { durationMs: true } },
    },
  })
  if (!project) throw new YoutubeVideoError('source_not_found', 'Source project was not found in this workspace.', 404)
  if (project.status === 'FAILED' || project.status === 'CANCELED') {
    throw new YoutubeVideoError('source_failed', 'The source video did not finish processing. Please upload it again.', 409)
  }
  if (project.status !== 'READY') {
    throw new YoutubeVideoError('source_not_ready', 'Source transcription is still processing.', 425)
  }
  const words = Array.isArray(project.transcriptWords)
    ? (project.transcriptWords as Array<{ w?: string; s?: number; e?: number; spk?: string | null }>).
        flatMap((word, index) => {
          if (typeof word?.w !== 'string' || typeof word.s !== 'number' || typeof word.e !== 'number') return []
          return [{ w: word.w, s: word.s, e: word.e, spk: word.spk ?? null }]
        })
    : []
  // In shared visual/audio mode, a silent READY video is still legitimate
  // source material. Legacy transcript-only fallback retains its old guard.
  if (!words.length && process.env.YOUTUBE_SHARED_PIPELINE === '0') {
    throw new YoutubeVideoError('source_no_transcript', 'The source finished without usable transcript words.', 422)
  }
  const durationMs = project.upload?.durationMs
    ?? Math.max(0, (project.rangeEndMs ?? 0) - (project.rangeStartMs ?? 0))
    ?? Math.round((words[words.length - 1]?.e ?? 0) * 1000)
  return { sourceId: project.id, projectId: project.id, title: project.title ?? undefined, durationMs, words }
}

/**
 * An actual output timeline: the first approved cut is the base edit and all
 * remaining Story cuts are E5b source-audio inserts in editorial order.
 * The same insert exporter also works when the same upload is referenced
 * multiple times and when a story uses more than one upload.
 */
export const writeYoutubeVideoClip: WriteYoutubeClip = async ({ workspaceId, createdById, runId, option, sources }) => {
  const prisma = getPrisma()
  const cuts = storyCutsInEditorialOrder(cutsFromOption(option))
  if (!cuts.length) throw new YoutubeVideoError('no_story_cuts', 'The chosen story has no usable source footage.', 422)
  youtubeRunEvent(runId, 'story_assembly', 'start', {
    sourceCount: sources.length, optionCount: 1, wordCount: cuts.length,
  })
  const projectIds = [...new Set(sources.map((s) => s.projectId))]
  const projects = await traceYoutubeRunStep(runId, 'source_media_validation', () => prisma.clipProject.findMany({
    where: { id: { in: projectIds }, workspaceId, deletedAt: null },
    select: { id: true, uploadId: true, upload: {
      select: { id: true, filename: true, mime: true, status: true, durationMs: true, width: true, height: true },
    } },
  }), { sourceCount: projectIds.length })
  const byProject = new Map(projects.map((p) => [p.id, p]))
  const bySource = new Map(sources.map((s) => [s.sourceId, s]))
  const uploads = cuts.map((cut) => {
    const source = bySource.get(cut.sourceId)
    const project = source && byProject.get(source.projectId)
    const upload = project?.upload
    if (!project?.uploadId || !upload || upload.status !== 'COMPLETE' || !upload.mime.startsWith('video/')) {
      throw new YoutubeVideoError('source_not_ready', 'One of the story source videos is unavailable.', 409)
    }
    if (cut.startMs < 0 || (upload.durationMs && cut.endMs > upload.durationMs + 1000)) {
      throw new YoutubeVideoError('source_range_invalid', 'A story cut exceeds the source recording.', 422)
    }
    return upload
  })
  // This is editorial order, not source timestamp order. Log each selected
  // segment before writing it, without transcript text or signed media URLs.
  cuts.forEach((cut, index) => youtubeRunEvent(runId, 'story_cut', 'selected', {
    sourceCount: index + 1, projectId: bySource.get(cut.sourceId)?.projectId,
    status: `${cut.startMs}-${cut.endMs}`,
  }))
  const first = cuts[0]!
  const firstSource = bySource.get(first.sourceId)
  if (!firstSource) throw new YoutubeVideoError('source_not_found', 'Story opening source is unavailable.', 404)

  const created = await traceYoutubeRunStep(runId, 'output_project_create', () => createAiProducerOutputProject({
    workspaceId, createdById: createdById ?? 'system',
    runId, title: option.title, sourceProjectId: firstSource.projectId,
    clipStartMs: first.startMs, clipEndMs: first.endMs,
  }), { projectId: firstSource.projectId })

  const distinctUploads = new Map(uploads.map((upload) => [upload.id, upload]))
  await traceYoutubeRunStep(runId, 'source_media_register', async () => {
    for (const upload of distinctUploads.values()) {
      await prisma.clipProjectMedia.upsert({
        where: { projectId_uploadId: { projectId: created.projectId, uploadId: upload.id } },
        create: {
          id: createId('pmed'), projectId: created.projectId, workspaceId, uploadId: upload.id,
          mediaType: 'video', label: upload.filename, durationMs: upload.durationMs,
          width: upload.width, height: upload.height, hasAudio: true,
        },
        update: { mediaType: 'video', durationMs: upload.durationMs },
      })
      const source = sources.find((s) => byProject.get(s.projectId)?.uploadId === upload.id)
      if (source) {
        await prisma.clipMediaTranscript.upsert({
          where: { projectId_ref_refId: { projectId: created.projectId, ref: 'upload', refId: upload.id } },
          create: {
            id: createId('mtr'), projectId: created.projectId, workspaceId,
            ref: 'upload', refId: upload.id, status: 'done',
            words: toPrismaJson(source.words), durationMs: upload.durationMs,
          },
          update: { status: 'done', words: toPrismaJson(source.words) },
        })
      }
      youtubeRunEvent(runId, 'source_media_register', 'upload_linked', { projectId: created.projectId })
    }
  }, { projectId: created.projectId, sourceCount: distinctUploads.size })

  const bounds = { clipStartMs: first.startMs, clipEndMs: first.endMs, trimMinMs: 0, trimMaxMs: first.endMs }
  const edits: ClipEditsV2 = await traceYoutubeRunStep(runId, 'segments_build', () =>
    buildYoutubeStoryEditAssembly(
      defaultEdits(bounds), cuts,
      uploads.map((upload) => ({ id: upload.id, label: upload.filename, durationMs: upload.durationMs })),
    ),
  { projectId: created.projectId })
  await traceYoutubeRunStep(runId, 'segments_write', () =>
    writeClipEditsOrThrow(created.clipId, bounds, 0, () => edits),
  { projectId: created.projectId })
  youtubeRunEvent(runId, 'segments_write', 'done', {
    projectId: created.projectId, sourceCount: distinctUploads.size, wordCount: cuts.length,
  })
  await traceYoutubeRunStep(runId, 'clip_metadata_save', async () => {
    const clip = await prisma.clip.findUniqueOrThrow({ where: { id: created.clipId } })
    const aiMeta = clip.aiMeta && typeof clip.aiMeta === 'object' && !Array.isArray(clip.aiMeta)
      ? { ...(clip.aiMeta as Record<string, unknown>) } : {}
    await prisma.clip.update({
      where: { id: created.clipId },
      data: { aiMeta: toPrismaJson({
        ...aiMeta, aiOriginalEdits: edits, youtubeVideoRunId: runId,
        youtubeStoryCuts: cuts,
        storySourceCount: distinctUploads.size,
      }) },
    })
  }, { projectId: created.projectId })

  const queued = await traceYoutubeRunStep(runId, 'render_queue', () => enqueueRenderClip(
    workspaceId, created.clipId, {
      resolution: '720p', aspect: '16:9', watermark: false,
      edits, clipStartMs: first.startMs, clipEndMs: first.endMs,
      previewKey: null, title: option.title,
    },
  ), { projectId: created.projectId })
  youtubeRunEvent(runId, 'render_queue', 'queued', {
    projectId: created.projectId, status: queued.render.status,
  })
  return {
    projectId: created.projectId, clipId: created.clipId,
    durationMs: cuts.reduce((sum, cut) => sum + cut.endMs - cut.startMs, 0),
    renderId: queued.render.id,
  }
}

export type YoutubeVideoRenderView = {
  status: 'queued' | 'rendering' | 'ready' | 'failed'
  playbackUrl: string | null
  downloadUrl: string | null
  thumbnailUrl: string | null
  error?: string | null
}

/** Signed links are generated only after the render's outputKey exists.
 * Never log a signed URL or full object key. */
export async function resolveYoutubeVideoRender(
  workspaceId: string, renderId: string, runId: string,
): Promise<YoutubeVideoRenderView> {
  const prisma = getPrisma()
  const render = await traceYoutubeRunStep(runId, 'render_poll', () => prisma.clipRender.findFirst({
    where: { id: renderId, workspaceId },
    select: {
      id: true, status: true, outputKey: true, filename: true,
      error: true, updatedAt: true, sizeBytes: true,
      clip: { select: { posterKey: true, project: { select: { thumbKey: true } } } },
    },
  }))
  if (!render) throw new YoutubeVideoError('render_not_found', 'The output render was not found.', 404)
  const status = render.status === 'READY' ? 'ready'
    : render.status === 'FAILED' ? 'failed'
    : render.status === 'RENDERING' ? 'rendering' : 'queued'
  if (status === 'ready' && !render.outputKey) {
    youtubeRunEvent(runId, 'render_poll', 'missing_output', { status: 'failed' })
    return { status: 'failed', playbackUrl: null, downloadUrl: null, thumbnailUrl: null,
      error: 'The video render completed without a playable file. Please retry.' }
  }
  if (status !== 'ready') {
    youtubeRunEvent(runId, 'render_poll', 'pending', { status })
    return { status, playbackUrl: null, downloadUrl: null, thumbnailUrl: null,
      error: status === 'failed' ? render.error ?? 'Rendering failed. Please retry.' : null }
  }
  const storage = getClipStorage()
  const versionHint = `youtube-render:${render.id}:${render.updatedAt.getTime()}:${render.sizeBytes?.toString() ?? ''}`
  const signed = await traceYoutubeRunStep(runId, 'render_sign', async () => {
    const playbackUrl = await createCachedSignedDownloadUrl(
      storage, render.outputKey!, { versionHint },
    )
    const downloadUrl = await createCachedSignedDownloadUrl(
      storage, render.outputKey!, {
        downloadFilename: render.filename || 'youtube-video.mp4', versionHint,
      },
    )
    const posterKey = render.clip?.posterKey ?? render.clip?.project.thumbKey
    let thumbnailUrl: string | null = null
    if (posterKey) {
      try {
        thumbnailUrl = await createCachedSignedDownloadUrl(storage, posterKey, { versionHint: `youtube-poster:${render.id}` })
      } catch (err) {
        youtubeRunEvent(runId, 'render_sign', 'poster_unavailable', {
          errorCode: err instanceof Error ? err.name : 'unknown',
        })
      }
    }
    return { playbackUrl, downloadUrl, thumbnailUrl }
  })
  youtubeRunEvent(runId, 'render_poll', 'done', { status: 'ready' })
  return { status: 'ready', ...signed }
}

export const revertYoutubeVideoClip: RevertClip = async ({ clipId }) => {
  const prisma = getPrisma()
  const clip = await prisma.clip.findUnique({ where: { id: clipId } })
  if (!clip) throw new Error('revert_not_available')
  const aiMeta = (clip.aiMeta && typeof clip.aiMeta === 'object') ? (clip.aiMeta as Record<string, unknown>) : {}
  const original = aiMeta.aiOriginalEdits
  if (!original) throw new Error('revert_not_available')
  const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs, trimMinMs: 0, trimMaxMs: clip.endMs }
  await writeClipEditsOrThrow(clipId, bounds, clip.editsSaveVersion, () => original as ClipEditsV2)
}

export function productionPipelineDeps(): YoutubeVideoPipelineDeps {
  return {
    importer: defaultStreamerImporter,
    loadReadySource,
    planShared: advanceYoutubeSharedStory,
  }
}

export function productionRunDeps(): YoutubeVideoRunDeps {
  return {
    store: getYoutubeVideoStore(),
    pipeline: productionPipelineDeps(),
    writeClip: writeYoutubeVideoClip,
    resolveRender: resolveYoutubeVideoRender,
    revertClip: revertYoutubeVideoClip,
  }
}
