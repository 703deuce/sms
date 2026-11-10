import type { Prisma } from '@prisma/client'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { unifiedRunIdFromSettings } from '@/lib/server/ai-producer-agent/unified-clip-recovery'
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
  const previousUnifiedRunId = unifiedRunIdFromSettings(project.settings)
  const settings = project.settings && typeof project.settings === 'object' && !Array.isArray(project.settings)
    ? { ...(project.settings as Record<string, unknown>) } : {}
  if (previousUnifiedRunId) {
    delete settings.unifiedClipRunId
    delete settings.autoAgentClipError
    // Ingest must trigger the same unified agent mode, not the classic picker.
    settings.autoAgentClipMode = 'clip_unified_v1'
  }

  await prisma.$transaction(async (tx) => {
    if (patch.resume && !previousUnifiedRunId) {
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
        ...(previousUnifiedRunId ? { settings: settings as Prisma.InputJsonValue } : {}),
      },
    })
    await tx.clipJob.create({
      data: {
        id: jobId,
        projectId,
        type: 'PROCESS_PROJECT',
        status: 'QUEUED',
        payload: clipperRetryJobPayload(patch.resume, previousUnifiedRunId ? settings : project.settings) as Prisma.InputJsonValue,
      },
    })
  })

  return { jobId, resume: patch.resume, status: 'QUEUED' as const }
}
