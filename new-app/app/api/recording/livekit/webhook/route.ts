import { NextResponse } from 'next/server'
import { WebhookReceiver } from 'livekit-server-sdk'
import { getLiveKitServerEnv } from '@/lib/server/livekit/env'
import { handleLivekitEvent } from '@/lib/server/livekit/webhooks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const env = getLiveKitServerEnv()
    const receiver = new WebhookReceiver(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET)
    const raw = await req.text()
    const auth = req.headers.get('authorization') ?? undefined
    const event = await receiver.receive(raw, auth)
    await handleLivekitEvent(event)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
