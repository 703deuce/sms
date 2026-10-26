import { NextResponse } from 'next/server'
import { verifyWorkerHmac } from '@/lib/server/clips/worker-auth'
import { getPrisma } from '@/lib/server/db'
import { decryptTwitchToken, twitchAppAccessToken } from '@/lib/server/streamer/twitch'

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyWorkerHmac(request, raw)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const prisma = getPrisma()
  const cutoffEvents = new Date(Date.now() - 7 * 86400_000)
  const cutoffChat = new Date(Date.now() - 30 * 86400_000)
  await prisma.streamWebhookEvent.deleteMany({ where: { receivedAt: { lt: cutoffEvents } } })
  await prisma.streamChatLine.deleteMany({ where: { at: { lt: cutoffChat } } })

  const twitchChannels = await prisma.streamChannel.findMany({
    where: { platform: 'twitch', status: 'CONNECTED', deletedAt: null, connectionId: { not: null } },
  })
  let validated = 0
  for (const ch of twitchChannels) {
    if (!ch.connectionId) continue
    const conn = await prisma.integrationConnection.findUnique({ where: { id: ch.connectionId } })
    const token = decryptTwitchToken(conn?.accessToken)
    if (!token) continue
    const res = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: { Authorization: `OAuth ${token}` },
    })
    if (res.ok) validated += 1
    else {
      await prisma.streamChannel.update({ where: { id: ch.id }, data: { status: 'NEEDS_REAUTH', autoProcess: false } })
    }
  }

  // Ensure app token works (Helix maintenance uses app creds from worker)
  try {
    await twitchAppAccessToken()
  } catch {
    /* logged by caller */
  }

  return NextResponse.json({ data: { validated, pruned: true } })
}
