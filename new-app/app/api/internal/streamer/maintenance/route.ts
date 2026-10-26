import { NextResponse } from 'next/server'
import { verifyWorkerHmac } from '@/lib/server/clips/worker-auth'
import { getPrisma } from '@/lib/server/db'
import { reapStaleJobs } from '@/lib/server/clips/jobs'
import { decryptTwitchToken, twitchAppAccessToken } from '@/lib/server/streamer/twitch'

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyWorkerHmac(request, raw)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const prisma = getPrisma()
  const result: Record<string, unknown> = { validated: 0, pruned: false, reaped: 0, errors: [] as string[] }

  try {
    const cutoffEvents = new Date(Date.now() - 7 * 86400_000)
    const cutoffChat = new Date(Date.now() - 30 * 86400_000)
    await prisma.streamWebhookEvent.deleteMany({ where: { receivedAt: { lt: cutoffEvents } } })
    await prisma.streamChatLine.deleteMany({ where: { at: { lt: cutoffChat } } })
    result.pruned = true
  } catch (err) {
    result.errors.push(`prune: ${err instanceof Error ? err.message : String(err)}`)
  }

  try {
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
    result.validated = validated
  } catch (err) {
    result.errors.push(`twitch_validate: ${err instanceof Error ? err.message : String(err)}`)
  }

  try {
    await twitchAppAccessToken()
  } catch {
    /* non-fatal */
  }

  try {
    result.reaped = await reapStaleJobs()
  } catch (err) {
    result.errors.push(`reaper: ${err instanceof Error ? err.message : String(err)}`)
    return NextResponse.json({ error: 'Reaper failed', data: result }, { status: 500 })
  }

  return NextResponse.json({ data: result })
}
