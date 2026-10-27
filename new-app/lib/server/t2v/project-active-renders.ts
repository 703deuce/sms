import 'server-only'
import type { PrismaClient } from '@prisma/client'

const ACTIVE_CLIP_JOB_TYPES = ['RENDER_CLIP', 'RENDER_SCRIPT_COMPOSITION', 'RENDER_EXPORT'] as const
const ACTIVE_CLIP_JOB_STATUSES = ['QUEUED', 'RUNNING'] as const
const ACTIVE_COMPOSITION_RENDER_STATUSES = ['QUEUED', 'RENDERING'] as const

/** True when a render or export for this project may still read the current source upload. */
export async function projectHasQueuedOrRunningRenderOrExport(
  prisma: PrismaClient,
  projectId: string,
): Promise<boolean> {
  const activeJob = await prisma.clipJob.findFirst({
    where: {
      projectId,
      type: { in: [...ACTIVE_CLIP_JOB_TYPES] },
      status: { in: [...ACTIVE_CLIP_JOB_STATUSES] },
    },
    select: { id: true },
  })
  if (activeJob) return true

  const activeRender = await prisma.scriptCompositionRender.findFirst({
    where: {
      status: { in: [...ACTIVE_COMPOSITION_RENDER_STATUSES] },
      composition: { projectId, deletedAt: null },
    },
    select: { id: true },
  })
  return Boolean(activeRender)
}
