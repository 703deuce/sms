import 'server-only'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { getCompositionForWorkspace } from '@/lib/server/clips/script-composition'
import { ensurePublishRenderPipeline, syncPublishOutputFromRender } from '@/lib/server/clips/composition-share'

export type SocialPlatform = 'tiktok' | 'youtube_shorts' | 'instagram_reels'

/** Queue social post using the same rendered composition export as web publish (clipper export pipeline). */
export async function enqueueCompositionSocialPublish(
  workspaceId: string,
  compositionId: string,
  platform: SocialPlatform,
  opts?: { caption?: string; title?: string },
) {
  const row = await getCompositionForWorkspace(workspaceId, compositionId)
  if (!row) return null

  await ensurePublishRenderPipeline(workspaceId, compositionId)
  const pub = await syncPublishOutputFromRender(compositionId)
  if (!pub?.outputKey) {
    return { status: 'processing' as const, renderPending: true }
  }

  const prisma = getPrisma()
  const jobId = createId('cjob')
  await prisma.clipJob.create({
    data: {
      id: jobId,
      projectId: row.projectId,
      type: 'SOCIAL_PUBLISH_COMPOSITION',
      status: 'QUEUED',
      payload: {
        compositionId,
        platform,
        outputKey: pub.outputKey,
        caption: opts?.caption?.slice(0, 2200) ?? '',
        title: opts?.title?.slice(0, 200) ?? row.title,
      },
    },
  })

  return { status: 'queued' as const, jobId, outputKey: pub.outputKey }
}
