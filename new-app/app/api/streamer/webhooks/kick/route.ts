import { createVerify } from 'node:crypto'
import { NextResponse } from 'next/server'
import { ingestLiveChatMessage } from '@/lib/server/streamer/chat-aggregator'
import { streamerLiveRealtimeEnabled } from '@/lib/server/streamer/env'
import { enqueueStreamAutopull } from '@/lib/server/streamer/autopull'
import { getPrisma } from '@/lib/server/db'

export const runtime = 'nodejs'

let cachedKey: { pem: string; at: number } | null = null

async function kickPublicKeyPem(): Promise<string> {
  if (cachedKey && Date.now() - cachedKey.at < 86400_000) return cachedKey.pem
  const res = await fetch('https://api.kick.com/public/v1/public-key')
  if (!res.ok) throw new Error('Kick public key fetch failed')
  const json = (await res.json()) as { data: { public_key: string } }
  const pem = json.data.public_key
  cachedKey = { pem, at: Date.now() }
  return pem
}

function verifyKickSignature(raw: string, headers: Headers, pem: string): boolean {
  const id = headers.get('Kick-Event-Message-Id') || ''
  const ts = headers.get('Kick-Event-Message-Timestamp') || ''
  const sigB64 = headers.get('Kick-Event-Signature') || ''
  if (!id || !ts || !sigB64) return false
  const payload = `${id}.${ts}.${raw}`
  const verify = createVerify('RSA-SHA256')
  verify.update(payload)
  verify.end()
  return verify.verify(pem, Buffer.from(sigB64, 'base64'))
}

export async function POST(request: Request) {
  const raw = await request.text()
  const pem = await kickPublicKeyPem()
  if (!verifyKickSignature(raw, request.headers, pem)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const messageId = request.headers.get('Kick-Event-Message-Id') || ''
  const prisma = getPrisma()
  try {
    await prisma.streamWebhookEvent.create({
      data: { id: messageId, platform: 'kick', type: request.headers.get('Kick-Event-Type') || 'unknown' },
    })
  } catch {
    return new NextResponse(null, { status: 204 })
  }

  const body = JSON.parse(raw) as { event: string; data: Record<string, unknown> }
  const event = body.event
  const data = body.data || {}

  if (event === 'chat.message.sent' && streamerLiveRealtimeEnabled()) {
    const broadcaster = data.broadcaster as { channel_slug?: string } | undefined
    const slug = String(broadcaster?.channel_slug || (data as { channel_slug?: string }).channel_slug || '')
    const ch = await prisma.streamChannel.findFirst({ where: { platform: 'kick', login: slug.toLowerCase() } })
    if (ch) {
      ingestLiveChatMessage(ch.id, {
        at: new Date(),
        user: String((data.sender as { username?: string } | undefined)?.username || 'user'),
        text: String(data.content || '').slice(0, 200),
      })
    }
  }

  if (event === 'livestream.status.updated') {
    const isLive = Boolean(data.is_live)
    const bc = data.broadcaster as { channel_slug?: string } | undefined
    const slug = String(bc?.channel_slug || (data as { slug?: string }).slug || '')
    const ch = await prisma.streamChannel.findFirst({ where: { platform: 'kick', login: slug.toLowerCase() } })
    if (!ch) return new NextResponse(null, { status: 204 })
    if (isLive) {
      await prisma.streamChannel.update({
        where: { id: ch.id },
        data: { platformState: { live: { startedAt: new Date().toISOString() } } },
      })
    } else {
      const ps = (ch.platformState as Record<string, unknown>) || {}
      const live = (ps.live as { startedAt?: string }) || {}
      const startedAt = live.startedAt ? new Date(live.startedAt) : new Date()
      await prisma.streamChannel.update({
        where: { id: ch.id },
        data: { platformState: { ...ps, live: null } },
      })
      if (ch.autoProcess) {
        await enqueueStreamAutopull(ch.id, startedAt, { platform: 'kick' })
      }
    }
  }

  return new NextResponse(null, { status: 204 })
}
