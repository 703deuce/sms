import type { ClipProjectStatus } from '@prisma/client'
import { mergeWatchdogSnap, type ClipperWatchdogSnap } from '@/lib/clips/clipper-watchdog'
import { getPrisma } from '@/lib/server/db'
import { shouldTouchLockedAt } from '@/lib/server/clips/jobs'
import { sanitizeClipProjectErrorForUser } from '@/lib/clips/user-facing-job-error'

function isCanceledTerminal(storedJobStatus: string, jobError?: string | null): boolean {
  if (storedJobStatus === 'CANCELED') return true
  if (storedJobStatus === 'FAILED' && jobError && /canceled/i.test(jobError)) return true
  return false
}

/** Jobs whose terminal failure must not touch clip_projects (export-only). */
export const EXPORT_RENDER_JOB_TYPES = new Set([
  'RENDER_CLIP',
  'RENDER_SCRIPT_COMPOSITION',
  'RENDER_EXPORT',
])

export const AGENT_SIDE_JOB_TYPES = new Set(['AI_PRODUCER_AGENT_ANALYZE','AI_PRODUCER_AGENT_RUN','STREAM_AGENT_BATCH'])

export function skipClipProjectPatchForWorkerProgress(input: {
  jobType?: string
  projectSourceKind?: string | null
}): boolean {
  if (input.jobType && AGENT_SIDE_JOB_TYPES.has(input.jobType)) return true
  if (input.jobType === 'MUSIC' && input.projectSourceKind === 't2v') return true
  if (input.jobType && EXPORT_RENDER_JOB_TYPES.has(input.jobType)) return true
  return false
}

async function isLatestT2vAssembleJob(projectId: string, jobId: string): Promise<boolean> {
  const prisma = getPrisma()
  const latest = await prisma.clipJob.findFirst({
    where: { projectId, type: 'T2V_ASSEMBLE' },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  return latest?.id === jobId
}

/**
 * FV4a: progress from a worker copy that no longer owns the job. The web watchdog / stale-lock
 * recovery requeues a job (status QUEUED, lockedBy NULL) and another slot may re-claim it (lockedBy =
 * that slot). The old copy's heartbeats used to flip a QUEUED job back to RUNNING and overwrite the
 * new attempt's progress.
 */
export function isStaleWorkerPost(
  stored: { status: string; lockedBy?: string | null },
  body: { workerId?: string; jobStatus?: string; progress?: number },
): boolean {
  if (body.workerId && stored.lockedBy && stored.lockedBy !== body.workerId) return true
  if (stored.status === 'QUEUED' && (body.jobStatus !== undefined || body.progress !== undefined)) return true
  return false
}

/** Single round-trip progress apply for worker heartbeats (no transcript blob). */
export async function applyWorkerJobProgress(input: {
  jobId: string
  jobType?: string
  draftId?: string | null
  storedJobStatus: string
  storedJobError?: string | null
  projectId: string
  projectSourceKind?: string | null
  projectStatus?: ClipProjectStatus
  stage?: string
  progress?: number
  error?: string | null
  jobStatus?: 'RUNNING' | 'DONE' | 'FAILED'
  transcriptWords?: unknown
  etaSeconds?: number
  chunkDone?: number
  chunkTotal?: number
  clipsReady?: number
  clipsTotal?: number
  transcriptionEngine?: 'deepgram' | 'local_whisper'
  transcriptionFallbackReason?: string
  /** FV4a: export render detail (real ffmpeg progress). */
  activity?: string
  renderStep?: number
  renderSteps?: number
  stepPct?: number
}) {
  const prisma = getPrisma()

  if (isCanceledTerminal(input.storedJobStatus, input.storedJobError)) {
    return
  }
  if (input.storedJobStatus === 'DONE' && input.jobType === 'T2V_ASSEMBLE') {
    /* Late DONE heartbeats must not touch draft (applyT2vAssembled already set READY). */
    if (input.jobStatus && input.jobStatus !== 'DONE') {
      return
    }
  }
  if (
    input.storedJobStatus === 'FAILED' &&
    input.jobStatus &&
    input.jobStatus !== 'FAILED' &&
    input.jobType === 'T2V_ASSEMBLE'
  ) {
    return
  }

  const skipProjectPatch = skipClipProjectPatchForWorkerProgress({
    jobType: input.jobType,
    projectSourceKind: input.projectSourceKind,
  })

  const projectPatch: Record<string, unknown> = {}
  if (!skipProjectPatch) {
    if (input.projectStatus) projectPatch.status = input.projectStatus
    let projectStage = input.stage
    if (input.jobStatus === 'DONE' && projectStage === 'done') projectStage = 'ready'
    if (projectStage !== undefined) projectPatch.stage = projectStage
    if (input.progress !== undefined) {
      // FIX1 (F3/G4): monotonic within a job; a fresh job (stored QUEUED) or a failure may reset.
      if (input.storedJobStatus === 'QUEUED' || input.jobStatus === 'FAILED') {
        projectPatch.progress = input.progress
      } else {
        const cur = await prisma.clipProject.findUnique({
          where: { id: input.projectId },
          select: { progress: true },
        })
        projectPatch.progress = Math.max(Number(cur?.progress ?? 0), Math.round(Number(input.progress)))
      }
    }
    if (input.error !== undefined) {
      projectPatch.error = sanitizeClipProjectErrorForUser(input.error)
    }
    if (input.transcriptWords !== undefined) projectPatch.transcriptWords = input.transcriptWords
  }

  const needsSettingsRead =
    !skipProjectPatch &&
    (input.etaSeconds !== undefined ||
      input.chunkDone !== undefined ||
      input.chunkTotal !== undefined ||
      input.clipsReady !== undefined ||
      input.clipsTotal !== undefined ||
      input.transcriptionEngine !== undefined ||
      input.transcriptionFallbackReason !== undefined)

  if (needsSettingsRead) {
    const project = await prisma.clipProject.findUnique({
      where: { id: input.projectId },
      select: { settings: true },
    })
    const settings = (project?.settings ?? {}) as Record<string, unknown>
    projectPatch.settings = {
      ...settings,
      ...(input.transcriptionEngine !== undefined
        ? { transcriptionEngine: input.transcriptionEngine }
        : {}),
      ...(input.transcriptionFallbackReason !== undefined
        ? { transcriptionFallbackReason: input.transcriptionFallbackReason }
        : {}),
      streamerProgress: {
        ...((settings.streamerProgress as Record<string, unknown>) ?? {}),
        ...(input.etaSeconds !== undefined ? { etaSeconds: input.etaSeconds } : {}),
        ...(input.chunkDone !== undefined ? { chunkDone: input.chunkDone } : {}),
        ...(input.chunkTotal !== undefined ? { chunkTotal: input.chunkTotal } : {}),
        ...(input.clipsReady !== undefined ? { clipsReady: input.clipsReady } : {}),
        ...(input.clipsTotal !== undefined ? { clipsTotal: input.clipsTotal } : {}),
        updatedAt: new Date().toISOString(),
      },
    }
  }

  const jobPayloadPatch: Record<string, unknown> = {}
  if (input.transcriptionEngine !== undefined) {
    jobPayloadPatch.transcriptionEngine = input.transcriptionEngine
  }
  if (input.transcriptionFallbackReason !== undefined) {
    jobPayloadPatch.transcriptionFallbackReason = input.transcriptionFallbackReason
  }
  if (
    input.stage !== undefined ||
    input.progress !== undefined ||
    input.jobStatus === 'RUNNING' ||
    (input.etaSeconds !== undefined && input.jobType === 'RENDER_CLIP')
  ) {
    const existingJob = await prisma.clipJob.findUnique({
      where: { id: input.jobId },
      select: { payload: true },
    })
    const prevPayload = (existingJob?.payload ?? {}) as Record<string, unknown>
    const prevWd = prevPayload.clipperWatchdog as ClipperWatchdogSnap | undefined
    jobPayloadPatch.clipperWatchdog = mergeWatchdogSnap(
      prevWd,
      input.stage,
      input.progress,
      Date.now(),
      input.activity,
    )
    if (input.etaSeconds !== undefined && input.jobType === 'RENDER_CLIP') {
      jobPayloadPatch.renderEtaSeconds = input.etaSeconds
    }
    if (input.jobType === 'RENDER_CLIP' && input.renderStep !== undefined) {
      jobPayloadPatch.renderDetail = {
        step: input.renderStep,
        steps: input.renderSteps ?? input.renderStep,
        stepPct: input.stepPct ?? null,
      }
      // No measured ETA yet → drop the previous attempt's / fake one instead of showing it forever.
      if (input.etaSeconds === undefined) jobPayloadPatch.renderEtaSeconds = null
    }
  }

  const heartbeat = shouldTouchLockedAt(input.storedJobStatus, input.jobStatus)
  const terminalFromBody = input.jobStatus === 'DONE' || input.jobStatus === 'FAILED'
  const jobPatch: Record<string, unknown> = {}
  if (input.jobStatus && !isCanceledTerminal(input.storedJobStatus, input.storedJobError)) {
    if (input.jobStatus === 'RUNNING' && input.storedJobStatus === 'FAILED') {
      /* stale worker — do not resurrect */
    } else {
      jobPatch.status = input.jobStatus
      if (terminalFromBody) jobPatch.finishedAt = new Date()
    }
  }
  if (heartbeat) jobPatch.lockedAt = new Date()

  if (Object.keys(jobPayloadPatch).length) {
    const job = await prisma.clipJob.findUnique({
      where: { id: input.jobId },
      select: { payload: true },
    })
    const prev = (job?.payload ?? {}) as Record<string, unknown>
    jobPatch.payload = { ...prev, ...jobPayloadPatch }
  }

  const t2vDraftPatch: Record<string, unknown> = {}
  if (input.jobType === 'T2V_ASSEMBLE' && input.draftId) {
    const terminalJob =
      input.jobStatus === 'DONE' ||
      input.storedJobStatus === 'DONE' ||
      isCanceledTerminal(input.storedJobStatus, input.storedJobError)
    const latest = terminalJob ? false : await isLatestT2vAssembleJob(input.projectId, input.jobId)
    if (latest) {
      const draftRow = await prisma.t2vDraft.findUnique({
        where: { id: input.draftId },
        select: { status: true },
      })
      if (draftRow?.status === 'READY') {
        /* Do not regress a completed build. */
      } else if (input.jobStatus === 'FAILED') {
        const err = input.error ?? ''
        if (!/canceled/i.test(err)) {
          t2vDraftPatch.status = 'DRAFT'
          t2vDraftPatch.stage = 'failed'
          t2vDraftPatch.progress = 0
          t2vDraftPatch.error = input.error ?? 'Build failed'
        }
      } else if (input.jobStatus === 'RUNNING') {
        t2vDraftPatch.status = 'ASSEMBLING'
        if (input.stage !== undefined) t2vDraftPatch.stage = input.stage
        if (input.progress !== undefined) t2vDraftPatch.progress = input.progress
      }
    }
  }

  if (
    input.clipsReady !== undefined ||
    input.clipsTotal !== undefined ||
    input.progress !== undefined ||
    input.stage !== undefined
  ) {
    console.info('[clipper:progress]', {
      projectId: input.projectId,
      jobId: input.jobId,
      stage: input.stage,
      progress: input.progress,
      clipsReady: input.clipsReady,
      clipsTotal: input.clipsTotal,
      etaSeconds: input.etaSeconds,
    })
  }

  await prisma.$transaction([
    ...(Object.keys(projectPatch).length
      ? [
          prisma.clipProject.update({
            where: { id: input.projectId },
            data: projectPatch,
          }),
        ]
      : []),
    ...(Object.keys(jobPatch).length
      ? [prisma.clipJob.update({ where: { id: input.jobId }, data: jobPatch })]
      : []),
    ...(Object.keys(t2vDraftPatch).length
      ? [
          prisma.t2vDraft.update({
            where: { id: input.draftId! },
            data: t2vDraftPatch,
          }),
        ]
      : []),
  ])
}
