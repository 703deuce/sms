import type { ClipProjectStatus } from '@prisma/client'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { pickStreamerRetryJobType, streamAnalyzePhaseComplete } from '@/lib/server/streamer/retry-project'
import { streamerProjectOperatorCancelled } from '@/lib/server/streamer/operator-cancel'

const NON_TERMINAL: ClipProjectStatus[] = [
  'QUEUED',
  'PREPARING',
  'TRANSCRIBING',
  'FINDING_CLIPS',
  'RENDERING',
]

export function streamerProjectNeedsRecovery(status: ClipProjectStatus) {
  return NON_TERMINAL.includes(status)
}

export function projectStatusForJobType(jobType: 'STREAM_IMPORT' | 'STREAM_ANALYZE' | 'STREAM_RENDER') {
  if (jobType === 'STREAM_RENDER') return 'RENDERING' as const
  if (jobType === 'STREAM_ANALYZE') return 'TRANSCRIBING' as const
  return 'PREPARING' as const
}

/** Enqueue a recovery job when the pipeline has no active worker job (orphan / lost on restart). */
export async function enqueueStreamerRecoveryJob(projectId: string, reason: string) {
  const prisma = getPrisma()
  const vod = await prisma.streamVod.findFirst({ where: { projectId } })
  if (!vod) return null

  const project = await prisma.clipProject.findUnique({ where: { id: projectId } })
  if (!project || !streamerProjectNeedsRecovery(project.status)) return null
  if (streamerProjectOperatorCancelled(project)) return null

  const active = await prisma.clipJob.findFirst({
    where: { projectId, status: { in: ['QUEUED', 'RUNNING'] } },
    select: { id: true },
  })
  if (active) return null

  const state =
    vod.state && typeof vod.state === 'object' && !Array.isArray(vod.state)
      ? (vod.state as Record<string, unknown>)
      : {}
  const hasAudioKey = Boolean(state.audioKey)
  const clipCount = await prisma.clip.count({ where: { projectId, deletedAt: null } })
  const jobType = pickStreamerRetryJobType(hasAudioKey, clipCount, streamAnalyzePhaseComplete(state))
  const jobId = createId('job')

  await prisma.$transaction([
    prisma.clipProject.update({
      where: { id: projectId },
      data: {
        status: projectStatusForJobType(jobType),
        stage: 'queued',
        error: null,
      },
    }),
    prisma.clipJob.create({
      data: {
        id: jobId,
        projectId,
        type: jobType,
        status: 'QUEUED',
        payload: { vodId: vod.id, resume: true, recovery: reason },
        priority: 55,
      },
    }),
  ])

  return { jobId, jobType }
}
