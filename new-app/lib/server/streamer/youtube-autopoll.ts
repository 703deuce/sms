import { getPrisma } from '@/lib/server/db'
import { streamerAutopullUiEnabled } from '@/lib/server/streamer/autopull-ui'
import { enqueueStreamAutopull } from '@/lib/server/streamer/autopull'

const POLL_INTERVAL_MS = Number(process.env.YOUTUBE_AUTOPULL_POLL_INTERVAL_MS || 5 * 60 * 1000)

/** YouTube has no stream.offline webhook in this product yet; poll connected channels when enabled. */
export async function pollYoutubeStreamChannels(): Promise<{ checked: number; enqueued: number }> {
  if (!streamerAutopullUiEnabled()) return { checked: 0, enqueued: 0 }
  const raw = process.env.STREAMER_YOUTUBE_AUTOPULL_ENABLED?.trim().toLowerCase()
  if (raw !== '1' && raw !== 'true' && raw !== 'yes') {
    return { checked: 0, enqueued: 0 }
  }
  const prisma = getPrisma()
  const channels = await prisma.streamChannel.findMany({
    where: {
      platform: 'youtube',
      status: 'CONNECTED',
      deletedAt: null,
      autoProcess: true,
      externalId: { not: null },
    },
    select: { id: true, externalId: true, platformState: true },
  })
  let enqueued = 0
  for (const ch of channels) {
    const ps = (ch.platformState as Record<string, unknown>) || {}
    const lastPoll = typeof ps.youtubeLastPollAt === 'string' ? Date.parse(ps.youtubeLastPollAt) : 0
    if (lastPoll && Date.now() - lastPoll < POLL_INTERVAL_MS) continue
    const channelId = String(ch.externalId)
    const apiKey = process.env.YOUTUBE_DATA_API_KEY?.trim()
    if (!apiKey) continue
    try {
      const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
      searchUrl.searchParams.set('part', 'snippet')
      searchUrl.searchParams.set('channelId', channelId)
      searchUrl.searchParams.set('type', 'video')
      searchUrl.searchParams.set('eventType', 'completed')
      searchUrl.searchParams.set('order', 'date')
      searchUrl.searchParams.set('maxResults', '3')
      searchUrl.searchParams.set('key', apiKey)
      const res = await fetch(searchUrl.toString())
      if (!res.ok) continue
      const json = (await res.json()) as {
        items?: { id?: { videoId?: string }; snippet?: { title?: string; publishedAt?: string } }[]
      }
      for (const item of json.items || []) {
        const videoId = item.id?.videoId
        const publishedAt = item.snippet?.publishedAt
        if (!videoId || !publishedAt) continue
        const streamedAt = new Date(publishedAt)
        if (Date.now() - streamedAt.getTime() > 7 * 86400_000) continue
        const existing = await prisma.streamVod.findFirst({
          where: { channelId: ch.id, externalId: videoId, triggeredBy: 'auto', url: { not: null } },
          select: { id: true },
        })
        if (existing) continue
        await enqueueStreamAutopull(ch.id, streamedAt, {
          platform: 'youtube',
          title: item.snippet?.title,
          streamSessionId: videoId,
        })
        enqueued += 1
        break
      }
      await prisma.streamChannel.update({
        where: { id: ch.id },
        data: {
          platformState: { ...ps, youtubeLastPollAt: new Date().toISOString() },
        },
      })
    } catch {
      /* skip channel */
    }
  }
  return { checked: channels.length, enqueued }
}
