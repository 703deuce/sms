import type { ClipProjectStatus } from '@prisma/client'
import {
  JOB_HEARTBEAT_STALE_MS,
  JOB_MAX_ATTEMPTS_BEFORE_FAIL,
  STREAMER_ORPHAN_PROJECT_GRACE_MS,
  PROJECT_STUCK_MS,
  reaperBackoffSeconds,
  shouldFailJobAfterStale,
  stalledProjectErrorMessage,
} from '@/lib/server/clips/job-reliability'
import { getPrisma } from '@/lib/server/db'
import { enqueueClipperRecoveryJob, isTranscriptReadyOrphan } from '@/lib/server/clips/recover-project'
import { clampEtaBetweenPolls, etaStageKey } from '@/lib/clips/eta-poll'
import { computeNonStreamerClipEtaSec } from '@/lib/server/clips/project-eta'
import { enqueueStreamerRecoveryJob } from '@/lib/server/streamer/recover-project'

const TERMINAL: ClipProjectStatus[] = ['READY', 'FAILED', 'CANCELED']

export async function getProjectStatus(workspaceId: string, projectId: string) {
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({ where: { id: projectId, workspaceId } })
  if (!project) return null
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
    if (project.status === 'QUEUED' && !hasWorkerProgress) {
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
      const stageKey = etaStageKey(project.status, project.stage)
      const previousPollEta =
        typeof sp.lastEtaPollSec === 'number' && sp.lastEtaPollSec > 0 ? sp.lastEtaPollSec : undefined
      const previousStageKey =
        typeof sp.lastEtaStageKey === 'string' ? sp.lastEtaStageKey : undefined
      if (workerEta > 0 && etaUpdatedAt) {
        const ageSec = Math.max(0, Math.floor((Date.now() - new Date(etaUpdatedAt).getTime()) / 1000))
        const aged = Math.max(0, workerEta - ageSec)
        etaSec = clampEtaBetweenPolls(aged, previousPollEta, stageKey, previousStageKey)
      } else if (workerEta > 0) {
        etaSec = clampEtaBetweenPolls(workerEta, previousPollEta, stageKey, previousStageKey)
      } else if (!isStreamer) {
        const sourceDurationSec = Math.max(0, (project.rangeEndMs - project.rangeStartMs) / 1000)
        etaSec = computeNonStreamerClipEtaSec({
          progress: project.progress,
          createdAtMs: project.createdAt.getTime(),
          status: project.status,
          stage: project.stage,
          sourceDurationSec,
          settings,
          chunkDone: typeof sp.chunkDone === 'number' ? sp.chunkDone : undefined,
          chunkTotal: typeof sp.chunkTotal === 'number' ? sp.chunkTotal : undefined,
          previousEtaSec: previousPollEta,
          previousStageKey,
        })
        if (etaSec > 0 && (etaSec !== previousPollEta || stageKey !== previousStageKey)) {
          void prisma.clipProject
            .update({
              where: { id: projectId },
              data: {
                settings: {
                  ...settings,
                  streamerProgress: {
                    ...sp,
                    lastEtaPollSec: etaSec,
                    lastEtaStageKey: stageKey,
                  },
                },
              },
            })
            .catch(() => {})
        }
      }
    } else if (!isStreamer && project.progress > 0) {
      const stageKey = etaStageKey(project.status, project.stage)
      const previousPollEta =
        typeof sp.lastEtaPollSec === 'number' && sp.lastEtaPollSec > 0 ? sp.lastEtaPollSec : undefined
      const previousStageKey =
        typeof sp.lastEtaStageKey === 'string' ? sp.lastEtaStageKey : undefined
      const sourceDurationSec = Math.max(0, (project.rangeEndMs - project.rangeStartMs) / 1000)
      etaSec = computeNonStreamerClipEtaSec({
        progress: project.progress,
        createdAtMs: project.createdAt.getTime(),
        status: project.status,
        stage: project.stage,
        sourceDurationSec,
        settings,
        chunkDone: typeof sp.chunkDone === 'number' ? sp.chunkDone : undefined,
        chunkTotal: typeof sp.chunkTotal === 'number' ? sp.chunkTotal : undefined,
        previousEtaSec: previousPollEta,
        previousStageKey,
      })
      if (etaSec > 0 && (etaSec !== previousPollEta || stageKey !== previousStageKey)) {
        void prisma.clipProject
          .update({
            where: { id: projectId },
            data: {
              settings: {
                ...settings,
                streamerProgress: {
                  ...sp,
                  lastEtaPollSec: etaSec,
                  lastEtaStageKey: stageKey,
                },
              },
            },
          })
          .catch(() => {})
      }
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
  'UPLOADING',
  'PREPARING',
  'TRANSCRIBING',
  'SCANNING',
  'FINDING_CLIPS',
  'REFRAMING',
  'RENDERING',
]

export async function reapStaleJobs() {
  const prisma = getPrisma()
  const heartbeatCutoff = new Date(Date.now() - JOB_HEARTBEAT_STALE_MS)
  const stale = await prisma.clipJob.findMany({
    where: {
      status: 'RUNNING',
      OR: [{ lockedAt: { lt: heartbeatCutoff } }, { lockedAt: null }],
    },
    take: 30,
    include: { project: { select: { id: true, status: true } } },
  })

  let requeued = 0
  let failed = 0

  for (const job of stale) {
    if (shouldFailJobAfterStale(job.attempts)) {
      const msg =
        job.error?.slice(0, 200) ||
        `Job timed out (no heartbeat for ${Math.round(JOB_HEARTBEAT_STALE_MS / 60_000)} min).`
      await prisma.$transaction([
        prisma.clipJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            error: msg,
            finishedAt: new Date(),
            lockedBy: null,
            lockedAt: null,
          },
        }),
        prisma.clipProject.update({
          where: { id: job.projectId },
          data: {
            status: 'FAILED',
            stage: 'failed',
            progress: 0,
            error: `${msg} Use Retry processing to resume.`,
          },
        }),
      ])
      failed += 1
      continue
    }

    const delaySec = reaperBackoffSeconds(job.attempts)
    await prisma.clipJob.update({
      where: { id: job.id },
      data: {
        status: 'QUEUED',
        lockedBy: null,
        lockedAt: null,
        runAfter: new Date(Date.now() + delaySec * 1000),
        error: `Watchdog requeued (retry in ~${delaySec}s)`,
      },
    })
    requeued += 1
  }

  const orphanCutoff = new Date(Date.now() - STREAMER_ORPHAN_PROJECT_GRACE_MS)
  const orphanStatuses: ClipProjectStatus[] = [...STUCK_PROJECT_STATUSES, 'QUEUED']
  const streamerOrphans = await prisma.clipProject.findMany({
    where: {
      status: { in: orphanStatuses },
      updatedAt: { lt: orphanCutoff },
      streamVod: { is: {} },
      jobs: { none: { status: { in: ['QUEUED', 'RUNNING'] } } },
    },
    select: { id: true },
    take: 15,
  })
  for (const project of streamerOrphans) {
    const recovered = await enqueueStreamerRecoveryJob(project.id, 'watchdog_orphan')
    if (recovered) requeued += 1
  }

  const legacyOrphans = await prisma.clipProject.findMany({
    where: {
      status: 'FINDING_CLIPS',
      stage: 'transcript_ready',
      streamVod: { is: null },
      jobs: { none: { status: { in: ['QUEUED', 'RUNNING'] } } },
    },
    select: { id: true, stage: true, status: true },
    take: 20,
  })
  for (const project of legacyOrphans) {
    if (!isTranscriptReadyOrphan(project.stage, project.status)) continue
    const recovered = await enqueueClipperRecoveryJob(project.id, 'watchdog_transcript_ready')
    if (recovered) requeued += 1
  }

  const clipperOrphans = await prisma.clipProject.findMany({
    where: {
      status: { in: orphanStatuses },
      updatedAt: { lt: orphanCutoff },
      streamVod: { is: null },
      jobs: { none: { status: { in: ['QUEUED', 'RUNNING'] } } },
    },
    select: { id: true, stage: true, status: true },
    take: 15,
  })
  for (const project of clipperOrphans) {
    if (isTranscriptReadyOrphan(project.stage, project.status)) continue
    const recovered = await enqueueClipperRecoveryJob(project.id, 'watchdog_orphan')
    if (recovered) requeued += 1
  }

  const stuckCutoff = new Date(Date.now() - PROJECT_STUCK_MS)
  const stuckProjects = await prisma.clipProject.findMany({
    where: {
      status: { in: STUCK_PROJECT_STATUSES },
      updatedAt: { lt: stuckCutoff },
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
          error: stalledProjectErrorMessage(project.status),
        },
      }),
      prisma.clipJob.updateMany({
        where: { projectId: project.id, status: { in: ['QUEUED', 'RUNNING'] } },
        data: {
          status: 'FAILED',
          error: 'Stalled — use Retry processing',
          finishedAt: new Date(),
          lockedBy: null,
          lockedAt: null,
        },
      }),
    ])
    failed += 1
  }

  return requeued + failed
}
