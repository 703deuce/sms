import type { ClipProjectStatus } from '@prisma/client'
import { getPrisma } from '@/lib/server/db'

const TERMINAL: ClipProjectStatus[] = ['READY', 'FAILED', 'CANCELED']

export async function getProjectStatus(workspaceId: string, projectId: string) {
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({ where: { id: projectId, workspaceId } })
  if (!project) return null
  const sourceMin = Math.max(1, Math.ceil((project.rangeEndMs - project.rangeStartMs) / 60_000))
  const settings = (project.settings ?? {}) as Record<string, unknown>
  const sp = (settings.streamerProgress ?? {}) as Record<string, number>
  const workerEta = typeof sp.etaSeconds === 'number' ? sp.etaSeconds : 0
  const etaUpdatedAt = typeof sp.updatedAt === 'string' ? sp.updatedAt : null
  const streamVod = await prisma.streamVod.findUnique({ where: { projectId }, select: { id: true } })
  const isStreamer = Boolean(streamVod)
  let etaSec = 0
  let queueAhead: number | undefined
  let waitingForWorker = false
  const queuedElapsedSec = Math.max(
    0,
    Math.floor((Date.now() - project.createdAt.getTime()) / 1000),
  )
  if (!TERMINAL.includes(project.status)) {
    const hasWorkerProgress =
      workerEta > 0 ||
      (typeof sp.chunkDone === 'number' && sp.chunkDone > 0) ||
      project.progress > 0 ||
      Boolean(project.stage && !['queued', 'Queued'].includes(project.stage))
    if (isStreamer && project.status === 'QUEUED' && !hasWorkerProgress) {
      waitingForWorker = true
      etaSec = 0
      const job = await prisma.clipJob.findFirst({
        where: { projectId, status: 'QUEUED' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, priority: true, createdAt: true },
      })
      if (job) {
        queueAhead = await prisma.clipJob.count({
          where: {
            status: 'QUEUED',
            OR: [
              { priority: { gt: job.priority } },
              { priority: job.priority, createdAt: { lt: job.createdAt } },
            ],
          },
        })
      }
    } else if (hasWorkerProgress) {
      if (workerEta > 0 && etaUpdatedAt) {
        const ageSec = Math.max(0, Math.floor((Date.now() - new Date(etaUpdatedAt).getTime()) / 1000))
        etaSec = Math.max(0, workerEta - ageSec)
      } else if (workerEta > 0) {
        etaSec = workerEta
      } else if (!isStreamer) {
        etaSec = sourceMin * 45
      }
    } else if (!isStreamer) {
      etaSec = sourceMin * 45
    }
  }
  const clipCount =
    project.status === 'READY'
      ? await prisma.clip.count({ where: { projectId, deletedAt: null } })
      : undefined
  return {
    status: project.status,
    stage: project.stage,
    progress: project.progress,
    error: project.error,
    etaSec,
    wordCount: Array.isArray(project.transcriptWords) ? (project.transcriptWords as unknown[]).length : 0,
    clipCount,
    chunkDone: typeof sp.chunkDone === 'number' ? sp.chunkDone : undefined,
    chunkTotal: typeof sp.chunkTotal === 'number' ? sp.chunkTotal : undefined,
    etaUpdatedAt,
    waitingForWorker,
    queueAhead,
    queuedElapsedSec,
    isStreamer,
  }
}

export async function cancelProject(workspaceId: string, projectId: string) {
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({ where: { id: projectId, workspaceId } })
  if (!project) throw new Error('Not found')
  if (TERMINAL.includes(project.status)) return project
  await prisma.$transaction([
    prisma.clipProject.update({
      where: { id: projectId },
      data: { status: 'CANCELED', stage: 'canceled', error: null },
    }),
    prisma.clipJob.updateMany({
      where: { projectId, status: { in: ['QUEUED', 'RUNNING'] } },
      data: { status: 'FAILED', error: 'Canceled by user', finishedAt: new Date() },
    }),
  ])
  return prisma.clipProject.findUniqueOrThrow({ where: { id: projectId } })
}

export function shouldTouchLockedAt(storedJobStatus: string, bodyJobStatus?: 'RUNNING' | 'DONE' | 'FAILED') {
  if (storedJobStatus === 'DONE' || storedJobStatus === 'FAILED') {
    return bodyJobStatus === 'RUNNING'
  }
  return storedJobStatus === 'RUNNING' || bodyJobStatus === 'RUNNING'
}

export async function applyJobProgress(input: {
  jobId: string
  projectStatus?: ClipProjectStatus
  stage?: string
  progress?: number
  error?: string | null
  transcriptWords?: unknown
  etaSeconds?: number
  chunkDone?: number
  chunkTotal?: number
}) {
  const prisma = getPrisma()
  const job = await prisma.clipJob.findUnique({ where: { id: input.jobId } })
  if (!job) throw new Error('Job not found')
  const data: Record<string, unknown> = {}
  if (input.projectStatus) data.status = input.projectStatus
  if (input.stage !== undefined) data.stage = input.stage
  if (input.progress !== undefined) data.progress = input.progress
  if (input.error !== undefined) data.error = input.error
  if (input.transcriptWords !== undefined) data.transcriptWords = input.transcriptWords
  if (
    input.etaSeconds !== undefined ||
    input.chunkDone !== undefined ||
    input.chunkTotal !== undefined
  ) {
    const project = await prisma.clipProject.findUnique({ where: { id: job.projectId } })
    const settings = (project?.settings ?? {}) as Record<string, unknown>
    const streamerProgress = {
      ...((settings.streamerProgress as Record<string, unknown>) ?? {}),
      ...(input.etaSeconds !== undefined ? { etaSeconds: input.etaSeconds } : {}),
      ...(input.chunkDone !== undefined ? { chunkDone: input.chunkDone } : {}),
      ...(input.chunkTotal !== undefined ? { chunkTotal: input.chunkTotal } : {}),
      updatedAt: new Date().toISOString(),
    }
    data.settings = { ...settings, streamerProgress }
  }
  if (Object.keys(data).length) {
    await prisma.clipProject.update({ where: { id: job.projectId }, data })
  }
}

const STUCK_PROJECT_STATUSES: ClipProjectStatus[] = [
  'IMPORTING',
  'PREPARING',
  'TRANSCRIBING',
  'FINDING_CLIPS',
  'RENDERING',
]

export async function reapStaleJobs() {
  const prisma = getPrisma()
  const cutoff = new Date(Date.now() - 5 * 60_000)
  const stale = await prisma.clipJob.findMany({
    where: { status: 'RUNNING', lockedAt: { lt: cutoff }, attempts: { lt: 3 } },
    take: 20,
  })
  for (const job of stale) {
    await prisma.clipJob.update({
      where: { id: job.id },
      data: {
        status: 'QUEUED',
        lockedBy: null,
        lockedAt: null,
        attempts: { increment: 1 },
        runAfter: new Date(),
      },
    })
  }

  const stuckCutoff = new Date(Date.now() - 90 * 60_000)
  const stuckProjects = await prisma.clipProject.findMany({
    where: {
      status: { in: STUCK_PROJECT_STATUSES },
      updatedAt: { lt: stuckCutoff },
      streamVod: { isNot: null },
    },
    select: { id: true, status: true },
    take: 10,
  })
  for (const project of stuckProjects) {
    await prisma.$transaction([
      prisma.clipProject.update({
        where: { id: project.id },
        data: {
          status: 'FAILED',
          stage: 'failed',
          progress: 0,
          error: 'Processing stalled. Use Retry processing to run again.',
        },
      }),
      prisma.clipJob.updateMany({
        where: { projectId: project.id, status: { in: ['QUEUED', 'RUNNING'] } },
        data: {
          status: 'FAILED',
          error: 'Stalled — requeue via Retry',
          finishedAt: new Date(),
          lockedBy: null,
          lockedAt: null,
        },
      }),
    ])
  }

  return stale.length + stuckProjects.length
}
