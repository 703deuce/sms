import type { ClipProjectStatus } from '@prisma/client'
import { getPrisma } from '@/lib/server/db'

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
        },
      },
    },
  })
  return rows.map((v) => {
    const settings = (v.project.settings ?? {}) as Record<string, unknown>
    const sp = (settings.streamerProgress ?? {}) as Record<string, number>
    const eta = etaForProject(v.project)
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
    }
  })
}
