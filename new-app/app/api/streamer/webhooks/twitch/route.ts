import { NextResponse } from 'next/server'
import { ingestLiveChatMessage } from '@/lib/server/streamer/chat-aggregator'
import { enqueueStreamAutopull } from '@/lib/server/streamer/autopull'
import { verifyTwitchEventSubSignature } from '@/lib/server/streamer/twitch-webhook'
import { handleStreamerNotify } from '@/lib/server/streamer/notify'
import { getPrisma } from '@/lib/server/db'

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

  if (subType === 'channel.chat.message') {
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
    await prisma.streamChannel.updateMany({
      where: { platform: 'twitch', externalId: broadcasterId },
      data: {
        platformState: {
          live: { startedAt: new Date().toISOString(), sessionId: String(event.id || messageId) },
        },
      },
    })
  }

  if (subType === 'stream.offline') {
    const broadcasterId = String(event.broadcaster_user_id || '')
    const ch = await prisma.streamChannel.findFirst({
      where: { platform: 'twitch', externalId: broadcasterId, deletedAt: null },
    })
    if (ch) {
      const ps = (ch.platformState as Record<string, unknown>) || {}
      const live = (ps.live as { startedAt?: string }) || {}
      const startedAt = live.startedAt ? new Date(live.startedAt) : new Date()
      await prisma.streamChannel.update({
        where: { id: ch.id },
        data: { platformState: { ...ps, live: null } },
      })
      if (ch.autoProcess) {
        await enqueueStreamAutopull(ch.id, startedAt, { platform: 'twitch' })
      } else {
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
