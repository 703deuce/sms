import { createId } from '@/lib/supabase/id'
import { enqueueTwitchClipIngest } from '@/lib/server/streamer/near-live/clip-ingest-queue'
import { createTwitchClipForChannel } from '@/lib/server/streamer/near-live/twitch-create-clip'
import { streamerNearLiveEnabled } from '@/lib/server/streamer/env'
import { getPrisma } from '@/lib/server/db'

const CLIP_CMD = /^!clip\b/i

export async function handleNearLiveChatLine(channelId: string, text: string, user: string) {
  if (!streamerNearLiveEnabled()) return
  if (!CLIP_CMD.test(text.trim())) return
  const prisma = getPrisma()
  const channel = await prisma.streamChannel.findUnique({ where: { id: channelId } })
  if (!channel) return
  const ps = (channel.platformState as Record<string, unknown>) || {}
  const nl = ps.nearLive as { projectId?: string } | undefined
  if (!nl?.projectId) return

  const created = await createTwitchClipForChannel(channelId, { hasDelay: true })
  if (!created) return

  await prisma.streamChatLine.create({
    data: {
      id: createId('scl'),
      channelId,
      at: new Date(),
      user: user.slice(0, 32),
      text: `!clip → Twitch clip ${created.clipId}`,
    },
  })
  await enqueueTwitchClipIngest(nl.projectId, channelId, created.clipId)
}
