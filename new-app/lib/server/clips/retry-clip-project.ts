import type { Prisma } from '@prisma/client'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import {
  clipperRetryJobPayload,
  clipperRetryProjectPatch,
} from '@/lib/server/clips/project-retry'

/** User-initiated Retry on a failed/canceled non-streamer clip project. */
export async function retryClipProject(workspaceId: string, projectId: string) {
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({ where: { id: projectId, workspaceId } })
  if (!project) return null

  const patch = clipperRetryProjectPatch(project)
  const jobId = createId('job')

  await prisma.$transaction(async (tx) => {
    if (patch.resume) {
      await tx.clip.updateMany({
        where: { projectId, deletedAt: null },
        data: { deletedAt: new Date() },
      })
    }
    await tx.clipProject.update({
      where: { id: projectId },
      data: {
        status: 'QUEUED',
        stage: patch.stage,
        progress: patch.progress,
        error: null,
      },
    })
    await tx.clipJob.create({
      data: {
        id: jobId,
        projectId,
        type: 'PROCESS_PROJECT',
        status: 'QUEUED',
        payload: clipperRetryJobPayload(patch.resume) as Prisma.InputJsonValue,
      },
    })
  })

  return { jobId, resume: patch.resume, status: 'QUEUED' as const }
}
