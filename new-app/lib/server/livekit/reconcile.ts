import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { getLiveKitApi } from '@/lib/server/livekit/client'
import { deleteRecordingRoom } from '@/lib/server/livekit/rooms'

const STALE_MS = 6 * 60 * 60 * 1000

/** Close DB sessions whose LiveKit room no longer exists or has been empty too long. */
export async function reconcileRecordingSessions(): Promise<{ closed: string[] }> {
  const prisma = getPrisma()
  const lk = getLiveKitApi()
  const liveRooms = await lk.room.listRooms()
  const liveNames = new Set(liveRooms.map((r) => r.name))

  const open = await prisma.recordingSession.findMany({
    where: { status: { in: ['DRAFT', 'LIVE'] } },
    select: { id: true, livekitRoom: true, updatedAt: true, liveEndedAt: true },
  })

  const closed: string[] = []
  const now = Date.now()

  for (const row of open) {
    const roomGone = !liveNames.has(row.livekitRoom)
    const stale = now - row.updatedAt.getTime() > STALE_MS
    if (!roomGone && !stale) continue

    if (!roomGone && stale) {
      try {
        await deleteRecordingRoom(row.id)
      } catch {
        /* room may already be closing */
      }
    }

    await prisma.recordingSession.update({
      where: { id: row.id },
      data: {
        status: 'ENDED',
        liveEndedAt: row.liveEndedAt ?? new Date(),
      },
    })
    closed.push(row.id)
  }

  return { closed }
}
