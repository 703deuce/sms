import type { ClipProjectStatus } from '@prisma/client'
import { canRetryClipProject } from '@/lib/server/clips/can-retry-clip-project'
import { getPrisma } from '@/lib/server/db'
import {
  resolveStreamPipelinePhase,
  streamPipelineLabel,
  type StreamPipelinePhase,
} from '@/lib/server/streamer/pipeline-status'

const TERMINAL: ClipProjectStatus[] = ['READY', 'FAILED', 'CANCELED']

export type StreamerVodRow = {
  vodId: string
  projectId: string
  title: string
  platform: string
  url: string | null
  status: ClipProjectStatus
  stage: string | null
  progress: number
  etaSec: number
  chunkDone?: number
  chunkTotal?: number
  waitingForWorker?: boolean
  queuedElapsedSec?: number
  createdAt: string
  triggeredBy: string
  pipelinePhase: StreamPipelinePhase
  pipelineLabel: string
  error: string | null
  canRetry: boolean
  channelId: string | null
}

function etaForProject(project: {
  status: ClipProjectStatus
  stage: string | null
  progress: number
  rangeEndMs: number
  rangeStartMs: number
  settings: unknown
  createdAt: Date
}) {
  const sourceMin = Math.max(1, Math.ceil((project.rangeEndMs - project.rangeStartMs) / 60_000))
  const settings = (project.settings ?? {}) as Record<string, unknown>
  const sp = (settings.streamerProgress ?? {}) as Record<string, number>
  const workerEta = typeof sp.etaSeconds === 'number' ? sp.etaSeconds : 0
  if (TERMINAL.includes(project.status)) return { etaSec: 0, waitingForWorker: false, queuedElapsedSec: 0 }
  const hasWorkerProgress =
    workerEta > 0 ||
    (typeof sp.chunkDone === 'number' && sp.chunkDone > 0) ||
    project.progress > 0 ||
    Boolean(project.stage && !['queued', 'Queued'].includes(project.stage))
  if (project.status === 'QUEUED' && !hasWorkerProgress) {
    return {
      etaSec: 0,
      waitingForWorker: true,
      queuedElapsedSec: Math.max(0, Math.floor((Date.now() - project.createdAt.getTime()) / 1000)),
    }
  }
  if (hasWorkerProgress) {
    return { etaSec: workerEta > 0 ? workerEta : 0, waitingForWorker: false, queuedElapsedSec: 0 }
  }
  return { etaSec: sourceMin * 45, waitingForWorker: false, queuedElapsedSec: 0 }
}

async function pendingAutopullProjectIds(projectIds: string[]): Promise<Set<string>> {
  if (!projectIds.length) return new Set()
  const prisma = getPrisma()
  const jobs = await prisma.clipJob.findMany({
    where: {
      projectId: { in: projectIds },
      type: 'STREAM_AUTOPULL',
      status: { in: ['QUEUED', 'RUNNING'] },
    },
    select: { projectId: true },
    distinct: ['projectId'],
  })
  return new Set(jobs.map((j) => j.projectId))
}

function mapStreamerVodRow(
  v: {
    id: string
    projectId: string
    title: string | null
    platform: string
    url: string | null
    triggeredBy: string
    channelId: string | null
    error: string | null
    createdAt: Date
    project: {
      id: string
      status: ClipProjectStatus
      stage: string | null
      progress: number
      settings: unknown
      rangeEndMs: number
      rangeStartMs: number
      createdAt: Date
      error: string | null
    }
  },
  pendingAutopull: boolean,
  clipCount: number,
): StreamerVodRow {
  const settings = (v.project.settings ?? {}) as Record<string, unknown>
  const sp = (settings.streamerProgress ?? {}) as Record<string, number>
  const eta = etaForProject(v.project)
  const phase = resolveStreamPipelinePhase({
    status: v.project.status,
    stage: v.project.stage,
    triggeredBy: v.triggeredBy,
    waitingForWorker: eta.waitingForWorker,
    pendingAutopull,
  })
  const err = v.project.error || v.error
  return {
    vodId: v.id,
    projectId: v.projectId,
    title: v.title?.trim() || 'Stream import',
    platform: v.platform,
    url: v.url,
    status: v.project.status,
    stage: v.project.stage,
    progress: v.project.progress,
    etaSec: eta.etaSec,
    waitingForWorker: eta.waitingForWorker,
    queuedElapsedSec: eta.queuedElapsedSec,
    chunkDone: typeof sp.chunkDone === 'number' ? sp.chunkDone : undefined,
    chunkTotal: typeof sp.chunkTotal === 'number' ? sp.chunkTotal : undefined,
    createdAt: v.createdAt.toISOString(),
    triggeredBy: v.triggeredBy,
    pipelinePhase: phase,
    pipelineLabel: streamPipelineLabel(phase, { platform: v.platform }),
    error: err,
    canRetry: canRetryClipProject({
      status: v.project.status,
      error: err,
      clipCount,
    }),
    channelId: v.channelId,
  }
}

export async function listStreamerVodsForWorkspace(workspaceId: string): Promise<StreamerVodRow[]> {
  const prisma = getPrisma()
  const rows = await prisma.streamVod.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      project: {
        select: {
          id: true,
          status: true,
          stage: true,
          progress: true,
          settings: true,
          rangeEndMs: true,
          rangeStartMs: true,
          createdAt: true,
          error: true,
        },
      },
    },
  })
  const projectIds = rows.map((r) => r.projectId)
  const autopullPending = await pendingAutopullProjectIds(projectIds)
  const clipCounts = await prisma.clip.groupBy({
    by: ['projectId'],
    where: { projectId: { in: projectIds }, deletedAt: null },
    _count: { _all: true },
  })
  const countByProject = new Map(clipCounts.map((c) => [c.projectId, c._count._all]))
  return rows.map((v) =>
    mapStreamerVodRow(v, autopullPending.has(v.projectId), countByProject.get(v.projectId) ?? 0),
  )
}

/** Auto-import / connected-channel pipeline rows (newest first). */
export async function listStreamerIncomingForWorkspace(workspaceId: string): Promise<StreamerVodRow[]> {
  const all = await listStreamerVodsForWorkspace(workspaceId)
  return all.filter((r) => r.triggeredBy === 'auto' || r.channelId != null)
}
