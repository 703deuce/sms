import type { ClipProjectStatus } from '@prisma/client'
import { getPrisma } from '@/lib/server/db'
import { shouldTouchLockedAt } from '@/lib/server/clips/jobs'

/** Single round-trip progress apply for worker heartbeats (no transcript blob). */
export async function applyWorkerJobProgress(input: {
  jobId: string
  jobType?: string
  draftId?: string | null
  storedJobStatus: string
  projectId: string
  projectStatus?: ClipProjectStatus
  stage?: string
  progress?: number
  error?: string | null
  jobStatus?: 'RUNNING' | 'DONE' | 'FAILED'
  transcriptWords?: unknown
  etaSeconds?: number
  chunkDone?: number
  chunkTotal?: number
  transcriptionEngine?: 'deepgram' | 'local_whisper'
  transcriptionFallbackReason?: string
}) {
  const prisma = getPrisma()
  const projectPatch: Record<string, unknown> = {}
  if (input.projectStatus) projectPatch.status = input.projectStatus
  if (input.stage !== undefined) projectPatch.stage = input.stage
  if (input.progress !== undefined) projectPatch.progress = input.progress
  if (input.error !== undefined) projectPatch.error = input.error
  if (input.transcriptWords !== undefined) projectPatch.transcriptWords = input.transcriptWords

  const needsSettingsRead =
    input.etaSeconds !== undefined ||
    input.chunkDone !== undefined ||
    input.chunkTotal !== undefined ||
    input.transcriptionEngine !== undefined ||
    input.transcriptionFallbackReason !== undefined

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

  const heartbeat = shouldTouchLockedAt(input.storedJobStatus, input.jobStatus)
  const terminalFromBody = input.jobStatus === 'DONE' || input.jobStatus === 'FAILED'
  const jobPatch: Record<string, unknown> = {}
  if (input.jobStatus) {
    jobPatch.status = input.jobStatus
    if (terminalFromBody) jobPatch.finishedAt = new Date()
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
    if (input.jobStatus === 'FAILED') {
      t2vDraftPatch.status = 'DRAFT'
      t2vDraftPatch.stage = 'failed'
      t2vDraftPatch.progress = 0
      t2vDraftPatch.error = input.error ?? 'Build failed'
    } else if (input.jobStatus === 'DONE') {
      t2vDraftPatch.status = 'READY'
      t2vDraftPatch.stage = input.stage ?? 'done'
      t2vDraftPatch.progress = input.progress ?? 100
      t2vDraftPatch.error = null
    } else if (input.jobStatus === 'RUNNING' || input.stage !== undefined || input.progress !== undefined) {
      t2vDraftPatch.status = 'ASSEMBLING'
      if (input.stage !== undefined) t2vDraftPatch.stage = input.stage
      if (input.progress !== undefined) t2vDraftPatch.progress = input.progress
    }
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
