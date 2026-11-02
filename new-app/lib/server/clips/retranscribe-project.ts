import type { Prisma } from '@prisma/client'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { buildProcessProjectJobPayload } from '@/lib/server/clips/process-project-payload'
import { clipperRetryProjectPatch } from '@/lib/server/clips/project-retry'

/** User-initiated verbatim re-transcribe (clears stored words, forces ASR). Does not run automatically. */
export async function retranscribeClipProject(workspaceId: string, projectId: string) {
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
    select: { id: true, uploadId: true, status: true, settings: true, sourceKind: true },
  })
  if (!project) return null
  if (!project.uploadId) return { error: 'no_upload' as const }
  if (project.sourceKind === 't2v') return { error: 'unsupported' as const }
  const terminal = ['READY', 'FAILED', 'CANCELED']
  if (!terminal.includes(project.status)) return { error: 'busy' as const }

  const patch = clipperRetryProjectPatch({
    progress: 0,
    transcriptWords: null,
    stage: 'queued',
    status: project.status,
  })
  const jobId = createId('job')
  const payload = buildProcessProjectJobPayload(project.settings, {
    force_retranscribe: true,
    resume: patch.resume,
  })

  await prisma.$transaction(async (tx) => {
    await tx.clipProject.update({
      where: { id: projectId },
      data: {
        status: 'QUEUED',
        stage: 'queued',
        progress: 0,
        error: null,
        transcriptWords: null as unknown as Prisma.InputJsonValue,
      },
    })
    await tx.clipJob.create({
      data: {
        id: jobId,
        projectId,
        type: 'PROCESS_PROJECT',
        status: 'QUEUED',
        payload: payload as Prisma.InputJsonValue,
      },
    })
  })

  return { jobId, status: 'QUEUED' as const }
}
