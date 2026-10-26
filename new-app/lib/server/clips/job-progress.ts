import type { ClipProjectStatus } from '@prisma/client'
import { getPrisma } from '@/lib/server/db'
import { shouldTouchLockedAt } from '@/lib/server/clips/jobs'

/** Single round-trip progress apply for worker heartbeats (no transcript blob). */
export async function applyWorkerJobProgress(input: {
  jobId: string
  storedJobStatus: string
  projectId: string
  projectStatus?: ClipProjectStatus
  stage?: string
  progress?: number
  error?: string | null
  jobStatus?: 'RUNNING' | 'DONE' | 'FAILED'
  etaSeconds?: number
  chunkDone?: number
  chunkTotal?: number
}) {
  const prisma = getPrisma()
  const projectPatch: Record<string, unknown> = {}
  if (input.projectStatus) projectPatch.status = input.projectStatus
  if (input.stage !== undefined) projectPatch.stage = input.stage
  if (input.progress !== undefined) projectPatch.progress = input.progress
  if (input.error !== undefined) projectPatch.error = input.error

  if (
    input.etaSeconds !== undefined ||
    input.chunkDone !== undefined ||
    input.chunkTotal !== undefined
  ) {
    const project = await prisma.clipProject.findUnique({
      where: { id: input.projectId },
      select: { settings: true },
    })
    const settings = (project?.settings ?? {}) as Record<string, unknown>
    projectPatch.settings = {
      ...settings,
      streamerProgress: {
        ...((settings.streamerProgress as Record<string, unknown>) ?? {}),
        ...(input.etaSeconds !== undefined ? { etaSeconds: input.etaSeconds } : {}),
        ...(input.chunkDone !== undefined ? { chunkDone: input.chunkDone } : {}),
        ...(input.chunkTotal !== undefined ? { chunkTotal: input.chunkTotal } : {}),
        updatedAt: new Date().toISOString(),
      },
    }
  }

  const heartbeat = shouldTouchLockedAt(input.storedJobStatus, input.jobStatus)
  const terminalFromBody = input.jobStatus === 'DONE' || input.jobStatus === 'FAILED'
  const jobPatch: Record<string, unknown> = {}
  if (input.jobStatus) {
    jobPatch.status = input.jobStatus
    if (terminalFromBody) jobPatch.finishedAt = new Date()
  }
  if (heartbeat) jobPatch.lockedAt = new Date()

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
  ])
}
