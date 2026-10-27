import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'
import { setRecordingRoomMetadata } from '@/lib/server/livekit/rooms'

export async function startRecordingTake(sessionId: string, workspaceId: string, startAtHostMs: number) {
  const prisma = getPrisma()
  const session = await prisma.recordingSession.findFirst({
    where: { id: sessionId, workspaceId },
    include: { takes: { orderBy: { index: 'desc' }, take: 1 } },
  })
  if (!session) return null
  const nextIndex = (session.takes[0]?.index ?? -1) + 1
  const take = await prisma.recordingTake.create({
    data: {
      id: createId('rtake'),
      sessionId,
      index: nextIndex,
      startAtHostMs: BigInt(startAtHostMs),
    },
  })
  await setRecordingRoomMetadata(sessionId, {
    v: 1,
    recState: 'countdown',
    takeId: take.id,
    startAtHostMs,
  })
  if (session.status === 'DRAFT') {
    await prisma.recordingSession.update({ where: { id: sessionId }, data: { status: 'LIVE' } })
  }
  return take
}

export async function stopRecordingTake(sessionId: string, workspaceId: string, takeId: string, stopAtHostMs: number) {
  const prisma = getPrisma()
  const take = await prisma.recordingTake.findFirst({
    where: { id: takeId, sessionId },
    include: { session: true },
  })
  if (!take || take.session.workspaceId !== workspaceId) return null
  await prisma.recordingTake.update({
    where: { id: takeId },
    data: { stopAtHostMs: BigInt(stopAtHostMs) },
  })
  await setRecordingRoomMetadata(sessionId, {
    v: 1,
    recState: 'idle',
  })
  return take
}
