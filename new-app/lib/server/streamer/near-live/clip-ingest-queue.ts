import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { hasClipIngestForId } from '@/lib/server/streamer/near-live/idempotency'

/** Idempotent: one ingest job per twitch clip id per project. */
export async function enqueueTwitchClipIngest(projectId: string, channelId: string, twitchClipId: string) {
  const prisma = getPrisma()
  const recent = await prisma.clipJob.findMany({
    where: { projectId, type: 'STREAM_NEAR_LIVE_CLIP_INGEST' },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, status: true, payload: true },
  })
  const match = recent.find((j) => hasClipIngestForId([j], twitchClipId))
  if (match) return match.id
  const jobId = createId('job')
  await prisma.clipJob.create({
    data: {
      id: jobId,
      projectId,
      type: 'STREAM_NEAR_LIVE_CLIP_INGEST',
      status: 'QUEUED',
      priority: 40,
      payload: { projectId, channelId, twitchClipId },
      runAfter: new Date(Date.now() + 30_000),
    },
  })
  return jobId
}
