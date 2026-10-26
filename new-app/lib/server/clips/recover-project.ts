import type { ClipProjectStatus } from '@prisma/client'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'

const NON_TERMINAL: ClipProjectStatus[] = [
  'UPLOADING',
  'QUEUED',
  'PREPARING',
  'TRANSCRIBING',
  'SCANNING',
  'FINDING_CLIPS',
  'REFRAMING',
  'RENDERING',
]

/** M3 worker bug: job DONE at FINDING_CLIPS + transcript_ready with no follow-up enqueue. */
export function isTranscriptReadyOrphan(stage: string | null | undefined, status: ClipProjectStatus) {
  return status === 'FINDING_CLIPS' && (stage ?? '').toLowerCase() === 'transcript_ready'
}

export function clipperProjectNeedsRecovery(status: ClipProjectStatus) {
  return NON_TERMINAL.includes(status)
}

/** Re-enqueue PROCESS_PROJECT when a regular clipper project lost its worker job. */
export async function enqueueClipperRecoveryJob(projectId: string, reason: string) {
  const prisma = getPrisma()
  const streamVod = await prisma.streamVod.findUnique({ where: { projectId }, select: { id: true } })
  if (streamVod) return null

  const project = await prisma.clipProject.findUnique({ where: { id: projectId } })
  if (!project || !clipperProjectNeedsRecovery(project.status)) return null

  const active = await prisma.clipJob.findFirst({
    where: { projectId, status: { in: ['QUEUED', 'RUNNING'] } },
    select: { id: true },
  })
  if (active) return null

  const jobId = createId('job')
  const resume = isTranscriptReadyOrphan(project.stage, project.status)

  await prisma.$transaction([
    prisma.clipProject.update({
      where: { id: projectId },
      data: {
        status: 'QUEUED',
        stage: 'queued',
        progress: resume ? project.progress : 0,
        error: null,
      },
    }),
    prisma.clipJob.create({
      data: {
        id: jobId,
        projectId,
        type: 'PROCESS_PROJECT',
        status: 'QUEUED',
        payload: { resume: true, recovery: reason },
        priority: 50,
      },
    }),
  ])

  return { jobId, jobType: 'PROCESS_PROJECT' as const }
}
