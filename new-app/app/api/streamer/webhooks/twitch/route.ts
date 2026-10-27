import type { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { ingestLiveChatMessage } from '@/lib/server/streamer/chat-aggregator'
import { streamerLiveRealtimeEnabled, streamerTwitchRollingEnabled } from '@/lib/server/streamer/env'
import { enqueueStreamAutopull } from '@/lib/server/streamer/autopull'
import {
  beginTwitchRollingSession,
  finalizeTwitchRollingSession,
} from '@/lib/server/streamer/rolling-autopull'
import { verifyTwitchEventSubSignature } from '@/lib/server/streamer/twitch-webhook'
import { handleStreamerNotify } from '@/lib/server/streamer/notify'
import { getPrisma } from '@/lib/server/db'
import { mergePlatformState } from '@/lib/server/streamer/platform-state'
import {
  appendChannelSkippedStream,
  checkTwitchChannelVodSaving,
  persistChannelVodSaving,
} from '@/lib/server/streamer/vod-health'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const raw = await request.text()
  const { ok, messageType, messageId } = verifyTwitchEventSubSignature(raw, request.headers)
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (messageType === 'webhook_callback_verification') {
    const json = JSON.parse(raw) as { challenge: string }
    return new NextResponse(json.challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }

  const prisma = getPrisma()
  try {
    await prisma.streamWebhookEvent.create({
      data: { id: messageId, platform: 'twitch', type: messageType },
    })
  } catch {
    return new NextResponse(null, { status: 204 })
  }

  const body = JSON.parse(raw) as { subscription: { type: string }; event: Record<string, unknown> }
  const subType = body.subscription?.type
  const event = body.event || {}

  if (subType === 'channel.chat.message' && streamerLiveRealtimeEnabled()) {
    const broadcasterId = String(event.broadcaster_user_id || '')
    const ch = await prisma.streamChannel.findFirst({
      where: { platform: 'twitch', externalId: broadcasterId, deletedAt: null },
    })
    if (ch) {
      ingestLiveChatMessage(ch.id, {
        at: new Date(),
        user: String(event.chatter_user_name || 'user'),
        color: String(event.color || '#FFFFFF'),
        text: String((event.message as { text?: string } | undefined)?.text || event.message || '').slice(0, 200),
      })
    }
  }

  if (subType === 'stream.online') {
    const broadcasterId = String(event.broadcaster_user_id || '')
    const channels = await prisma.streamChannel.findMany({
      where: { platform: 'twitch', externalId: broadcasterId, deletedAt: null },
    })
    const startedAt = new Date()
    const streamSessionId = String(event.id || messageId)
    for (const ch of channels) {
      await prisma.streamChannel.update({
        where: { id: ch.id },
        data: {
          platformState: mergePlatformState(ch.platformState, {
            live: { startedAt: startedAt.toISOString(), sessionId: streamSessionId },
          }) as Prisma.InputJsonValue,
        },
      })
      if (streamerTwitchRollingEnabled() && ch.autoProcess) {
        await beginTwitchRollingSession(ch.id, startedAt, streamSessionId)
      }
    }
  }

  if (subType === 'stream.offline') {
    const broadcasterId = String(event.broadcaster_user_id || '')
    const ch = await prisma.streamChannel.findFirst({
      where: { platform: 'twitch', externalId: broadcasterId, deletedAt: null },
    })
    if (ch) {
      const ps = (ch.platformState as Record<string, unknown>) || {}
      const live = (ps.live as { startedAt?: string; sessionId?: string }) || {}
      const startedAt = live.startedAt ? new Date(live.startedAt) : new Date()
      const streamSessionId = live.sessionId ? String(live.sessionId) : undefined
      await prisma.streamChannel.update({
        where: { id: ch.id },
        data: { platformState: mergePlatformState(ch.platformState, { live: null }) as Prisma.InputJsonValue },
      })
      if (ch.autoProcess && ch.externalId) {
        const vodHealth = await checkTwitchChannelVodSaving(ch.externalId, ch.login)
        await persistChannelVodSaving(ch.id, vodHealth)
        if (vodHealth.status === 'blocked') {
          await appendChannelSkippedStream(ch.id, {
            at: new Date().toISOString(),
            code: vodHealth.code,
            message: vodHealth.message,
            title: `Stream ${startedAt.toISOString().slice(0, 16)}`,
            streamSessionId,
          })
          await handleStreamerNotify({
            workspaceId: ch.workspaceId,
            type: 'stream_ready',
            data: {
              title: 'Auto-clip skipped',
              action: 'vod_settings',
              channelId: ch.id,
              reason: vodHealth.message,
            },
          })
        } else if (streamerTwitchRollingEnabled() && (await finalizeTwitchRollingSession(ch.id))) {
          console.info(`[clipper:stream] rolling_finalize channelId=${ch.id}`)
        } else {
          await enqueueStreamAutopull(ch.id, startedAt, { platform: 'twitch', streamSessionId })
        }
      } else if (!ch.autoProcess) {
        await handleStreamerNotify({
          workspaceId: ch.workspaceId,
          type: 'stream_ready',
          data: { title: 'Stream ended', projectId: undefined, action: 'import_prompt', channelId: ch.id },
        })
      }
    }
  }

  if (messageType === 'revocation') {
    const broadcasterId = String(event.broadcaster_user_id || '')
    await prisma.streamChannel.updateMany({
      where: { platform: 'twitch', externalId: broadcasterId },
      data: { status: 'NEEDS_REAUTH', autoProcess: false },
    })
  }

  return new NextResponse(null, { status: 204 })
}
