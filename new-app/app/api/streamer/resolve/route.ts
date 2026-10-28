import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { parseStreamUrl } from '@/lib/streamer/url'
import { fetchTwitchVideoById } from '@/lib/server/streamer/vod-health'
import { resolveTwitchChannelPaste } from '@/lib/server/streamer/twitch-channel-paste'
import { parseTwitchDuration } from '@/lib/server/streamer/twitch-growing'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.object({ url: z.string().min(8).max(2000) })

export async function POST(request: Request) {
  try {
    await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    const parsed = parseStreamUrl(body.url)
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    if (parsed.platform === 'twitch' && parsed.kind === 'channel') {
      const login = parsed.channel ?? parsed.id
      const resolved = await resolveTwitchChannelPaste(login)
      if ('error' in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: 400 })
      }
      return NextResponse.json({
        data: {
          platform: 'twitch',
          kind: 'vod',
          id: resolved.vodId,
          channel: resolved.channelLogin,
          title: resolved.title,
          durationS: resolved.durationSec,
          thumbnailUrl: null,
          isLive: resolved.isLive,
          vodSource: resolved.source,
          resolvedVodUrl: resolved.vodUrl,
          pastedAs: 'channel',
          channelLogin: resolved.channelLogin,
        },
      })
    }

    let title: string | null = null
    let durationS: number | null = null
    if (parsed.platform === 'twitch' && parsed.kind === 'vod') {
      const video = await fetchTwitchVideoById(parsed.id)
      if (video) {
        title = video.title
        durationS = video.duration ? parseTwitchDuration(video.duration) : null
      }
    }

    return NextResponse.json({
      data: {
        platform: parsed.platform,
        kind: parsed.kind,
        id: parsed.id,
        channel: parsed.channel,
        title,
        durationS,
        thumbnailUrl: null,
        isLive: false,
        vodSource: null,
        resolvedVodUrl: null,
        pastedAs: parsed.kind,
        channelLogin: parsed.channel ?? null,
      },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}
