import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { getLiveKitApi } from '@/lib/server/livekit/client'
import { roomNameForSession } from '@/lib/server/livekit/rooms'

export async function assertSessionHost(sessionId: string, workspaceId: string, actorParticipantId: string) {
  const prisma = getPrisma()
  const host = await prisma.recordingParticipant.findFirst({
    where: { sessionId, id: actorParticipantId, role: 'HOST' },
  })
  const session = await prisma.recordingSession.findFirst({ where: { id: sessionId, workspaceId } })
  if (!session || !host) throw new Error('Forbidden')
  return session
}

export async function kickParticipant(sessionId: string, workspaceId: string, identity: string) {
  const prisma = getPrisma()
  const session = await prisma.recordingSession.findFirst({ where: { id: sessionId, workspaceId } })
  if (!session) throw new Error('Not found')
  const lk = getLiveKitApi()
  await lk.room.removeParticipant(roomNameForSession(sessionId), identity)
  await prisma.recordingParticipant.updateMany({
    where: { id: identity, sessionId },
    data: { status: 'REMOVED' },
  })
}

export async function muteParticipantTrack(
  sessionId: string,
  workspaceId: string,
  identity: string,
  trackSid: string,
  muted: boolean,
) {
  const prisma = getPrisma()
  const session = await prisma.recordingSession.findFirst({ where: { id: sessionId, workspaceId } })
  if (!session) throw new Error('Not found')
  const lk = getLiveKitApi()
  await lk.room.mutePublishedTrack(roomNameForSession(sessionId), identity, trackSid, muted)
}
