import 'server-only'

import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'

/** Enqueue worker REPLACE_CLIP after user hides/dislikes a result card. */
export async function enqueueReplaceClip(workspaceId: string, replacedClipId: string) {
  const prisma = getPrisma()
  const clip = await prisma.clip.findFirst({
    where: { id: replacedClipId, workspaceId, deletedAt: null },
    select: { id: true, projectId: true },
  })
  if (!clip) return null

  const active = await prisma.clipJob.findFirst({
    where: {
      clipId: replacedClipId,
      type: 'REPLACE_CLIP',
      status: { in: ['QUEUED', 'RUNNING'] },
    },
    select: { id: true },
  })
  if (active) {
    console.info('[clipper:replace] skip duplicate job', {
      clipId: replacedClipId,
      jobId: active.id,
    })
    return { jobId: active.id, deduped: true as const }
  }

  const jobId = createId('job')
  await prisma.clipJob.create({
    data: {
      id: jobId,
      projectId: clip.projectId,
      clipId: replacedClipId,
      type: 'REPLACE_CLIP',
      status: 'QUEUED',
      payload: { replacedClipId },
      priority: 40,
    },
  })
  console.info('[clipper:replace] enqueued', { clipId: replacedClipId, jobId, projectId: clip.projectId })
  return { jobId, deduped: false as const }
}
