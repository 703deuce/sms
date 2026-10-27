import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'
import { ensureRecordingRoom, roomNameForSession } from '@/lib/server/livekit/rooms'
import { mintJoinToken } from '@/lib/server/livekit/tokens'
import { getLiveKitPublicUrl } from '@/lib/server/livekit/env'

export async function createRecordingSession(input: {
  workspaceId: string
  title: string
  projectId?: string | null
  hostDisplayName: string
  maxParticipants?: number
}) {
  const id = createId('recs')
  const livekitRoom = roomNameForSession(id)
  const maxParticipants = input.maxParticipants ?? 6
  const prisma = getPrisma()

  const session = await prisma.recordingSession.create({
    data: {
      id,
      workspaceId: input.workspaceId,
      projectId: input.projectId ?? null,
      title: input.title,
      livekitRoom,
      maxParticipants,
      status: 'DRAFT',
      participants: {
        create: {
          id: createId('recp'),
          role: 'HOST',
          displayName: input.hostDisplayName,
        },
      },
    },
    include: { participants: true },
  })

  await ensureRecordingRoom(id, maxParticipants)

  const host = session.participants.find((p) => p.role === 'HOST')
  if (!host) throw new Error('Host participant missing')

  const token = await mintJoinToken({
    roomName: livekitRoom,
    identity: host.id,
    displayName: host.displayName,
    role: 'host',
    sessionId: id,
  })

  return {
    session,
    token,
    url: getLiveKitPublicUrl(),
  }
}

export async function mintHostTokenForSession(sessionId: string, workspaceId: string) {
  const prisma = getPrisma()
  const session = await prisma.recordingSession.findFirst({
    where: { id: sessionId, workspaceId },
    include: { participants: { where: { role: 'HOST' }, take: 1 } },
  })
  if (!session) return null
  const host = session.participants[0]
  if (!host) return null
  const token = await mintJoinToken({
    roomName: session.livekitRoom,
    identity: host.id,
    displayName: host.displayName,
    role: 'host',
    sessionId: session.id,
  })
  return { token, url: getLiveKitPublicUrl(), identity: host.id }
}

export async function joinRecordingSessionAsGuest(
  sessionId: string,
  workspaceId: string,
  displayName: string,
) {
  const prisma = getPrisma()
  const session = await prisma.recordingSession.findFirst({
    where: { id: sessionId, workspaceId },
    include: { participants: true },
  })
  if (!session) return null
  if (session.status === 'ENDED' || session.status === 'FAILED') {
    throw new Error('Session is closed')
  }
  if (session.participants.length >= session.maxParticipants) {
    throw new Error('Room is full')
  }
  const participantId = createId('recp')
  const participant = await prisma.recordingParticipant.create({
    data: {
      id: participantId,
      sessionId: session.id,
      role: 'GUEST',
      displayName: displayName.slice(0, 120),
      status: 'JOINED',
    },
  })
  if (session.status === 'DRAFT') {
    await prisma.recordingSession.update({ where: { id: sessionId }, data: { status: 'LIVE' } })
  }
  const token = await mintJoinToken({
    roomName: session.livekitRoom,
    identity: participant.id,
    displayName: participant.displayName,
    role: 'guest',
    sessionId: session.id,
  })
  return {
    participantId: participant.id,
    token,
    url: getLiveKitPublicUrl(),
  }
}
