import 'server-only'

import { defaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { getPrisma } from '@/lib/server/db'
import { writeClipEditsOrThrow } from '@/lib/server/clips/write-clip-edits'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import { createAiProducerOutputProject } from '@/lib/server/ai-producer-agent/create-output-project'
import { sortAndMergeCuts } from '@/lib/youtube-video/assemble'
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
    if (['sources', 'ingested', 'options', 'result'].includes(key)) {
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
  if (!words.length) throw new YoutubeVideoError('source_no_transcript', 'The source finished without usable transcript words.', 422)
  const durationMs = project.upload?.durationMs
    ?? Math.max(0, (project.rangeEndMs ?? 0) - (project.rangeStartMs ?? 0))
    ?? Math.round((words[words.length - 1]?.e ?? 0) * 1000)
  return { sourceId: project.id, projectId: project.id, title: project.title ?? undefined, durationMs, words }
}

export const writeYoutubeVideoClip: WriteYoutubeClip = async ({ workspaceId, createdById, runId, option, sources }) => {
  const cuts = sortAndMergeCuts(cutsFromOption(option))
  if (!cuts.length) throw new Error('apply_failed')
  const first = cuts[0]!
  const source = sources.find((item) => item.sourceId === first.sourceId) ?? sources[0]!
  const created = await createAiProducerOutputProject({
    workspaceId,
    createdById: createdById ?? 'system',
    runId,
    title: option.title,
    sourceProjectId: source.projectId,
    clipStartMs: first.startMs,
    clipEndMs: first.endMs,
  })
  const durationMs = cuts.reduce((sum, cut) => sum + (cut.endMs - cut.startMs), 0)
  const bounds = { clipStartMs: first.startMs, clipEndMs: first.endMs, trimMinMs: 0, trimMaxMs: first.endMs }
  const base = defaultEdits(bounds)
  const edits: ClipEditsV2 = { ...base }
  await writeClipEditsOrThrow(created.clipId, bounds, 0, () => edits)
  const prisma = getPrisma()
  const clip = await prisma.clip.findUniqueOrThrow({ where: { id: created.clipId } })
  const aiMeta = (clip.aiMeta && typeof clip.aiMeta === 'object') ? { ...(clip.aiMeta as Record<string, unknown>) } : {}
  aiMeta.aiOriginalEdits = edits
  aiMeta.youtubeVideoRunId = runId
  await prisma.clip.update({ where: { id: created.clipId }, data: { aiMeta: toPrismaJson(aiMeta) } })
  return { projectId: created.projectId, clipId: created.clipId, durationMs }
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
  }
}

export function productionRunDeps(): YoutubeVideoRunDeps {
  return {
    store: getYoutubeVideoStore(),
    pipeline: productionPipelineDeps(),
    writeClip: writeYoutubeVideoClip,
    revertClip: revertYoutubeVideoClip,
  }
}
