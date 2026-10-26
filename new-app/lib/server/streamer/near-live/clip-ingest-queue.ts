import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'

/** Idempotent: one queued ingest per twitch clip id per project. */
export async function enqueueTwitchClipIngest(projectId: string, channelId: string, twitchClipId: string) {
  const prisma = getPrisma()
  const existing = await prisma.clipJob.findFirst({
    where: {
      projectId,
      type: 'STREAM_NEAR_LIVE_CLIP_INGEST',
      status: { in: ['QUEUED', 'RUNNING'] },
    },
  })
  if (existing) {
    const payload = existing.payload as { twitchClipId?: string }
    if (payload?.twitchClipId === twitchClipId) return existing.id
  }
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
