import { Prisma } from '@prisma/client'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'

/** True when STREAM_ANALYZE finished (rank/enqueue render) even if zero clip rows. */
export function streamAnalyzePhaseComplete(state: Record<string, unknown>): boolean {
  return Boolean(state.candidatesKey || state.signalsKey || state.rankingVersion)
}

export function pickStreamerRetryJobType(
  hasAudioKey: boolean,
  clipCount: number,
  analyzeComplete = false,
) {
  if (!hasAudioKey) return 'STREAM_IMPORT' as const
  if (clipCount > 0 || analyzeComplete) return 'STREAM_RENDER' as const
  return 'STREAM_ANALYZE' as const
}

/** Re-queue streamer pipeline from last durable state (import → analyze → render). */
export async function retryStreamerProject(workspaceId: string, projectId: string) {
  const prisma = getPrisma()
  const vod = await prisma.streamVod.findFirst({ where: { projectId, workspaceId } })
  if (!vod) throw new Error('Not a streamer project')

  const state =
    vod.state && typeof vod.state === 'object' && !Array.isArray(vod.state)
      ? (vod.state as Record<string, unknown>)
      : {}

  const hasAudioKey = Boolean(state.audioKey)
  const clipCount = await prisma.clip.count({ where: { projectId, deletedAt: null } })
  const jobType = pickStreamerRetryJobType(hasAudioKey, clipCount, streamAnalyzePhaseComplete(state))
  const payload: Record<string, unknown> = { vodId: vod.id, resume: true }

  const jobId = createId('job')
  await prisma.$transaction([
    prisma.clipProject.update({
      where: { id: projectId },
      data: {
        status:
          jobType === 'STREAM_RENDER'
            ? 'RENDERING'
            : jobType === 'STREAM_ANALYZE'
              ? 'TRANSCRIBING'
              : 'PREPARING',
        stage: 'queued',
        progress: 0,
        error: null,
      },
    }),
    prisma.clipJob.create({
      data: {
        id: jobId,
        projectId,
        type: jobType,
        status: 'QUEUED',
        payload: payload as Prisma.InputJsonValue,
        priority: 50,
      },
    }),
  ])

  return { jobId, jobType }
}
