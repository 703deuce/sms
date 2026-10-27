import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'
import { mintJoinToken } from '@/lib/server/livekit/tokens'
import { getLiveKitPublicUrl } from '@/lib/server/livekit/env'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function mintInviteToken(): string {
  return randomBytes(32).toString('base64url')
}

export async function createRecordingInvite(sessionId: string, workspaceId: string) {
  const prisma = getPrisma()
  const session = await prisma.recordingSession.findFirst({
    where: { id: sessionId, workspaceId },
    select: { id: true, status: true },
  })
  if (!session) return null
  if (session.status === 'ENDED' || session.status === 'FAILED') {
    throw new Error('Session is not accepting invites')
  }
  const token = mintInviteToken()
  const invite = await prisma.recordingInvite.create({
    data: {
      id: createId('rinv'),
      sessionId,
      tokenHash: hashInviteToken(token),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  })
  return { inviteId: invite.id, inviteToken: token, expiresAt: invite.expiresAt }
}

export async function joinRecordingWithInvite(input: {
  inviteToken: string
  displayName: string
}) {
  const prisma = getPrisma()
  const tokenHash = hashInviteToken(input.inviteToken)
  const invite = await prisma.recordingInvite.findUnique({
    where: { tokenHash },
    include: { session: { include: { participants: true } } },
  })
  if (!invite) return { error: 'invalid' as const }
  if (invite.usedAt) return { error: 'used' as const }
  if (invite.expiresAt.getTime() < Date.now()) return { error: 'expired' as const }

  const session = invite.session
  if (session.status === 'ENDED' || session.status === 'FAILED') {
    return { error: 'closed' as const }
  }
  if (session.participants.length >= session.maxParticipants) {
    return { error: 'full' as const }
  }

  const participantId = createId('recp')
  const participant = await prisma.$transaction(async (tx) => {
    const row = await tx.recordingParticipant.create({
      data: {
        id: participantId,
        sessionId: session.id,
        role: 'GUEST',
        displayName: input.displayName.slice(0, 120),
        status: 'INVITED',
      },
    })
    await tx.recordingInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    })
    if (session.status === 'DRAFT') {
      await tx.recordingSession.update({
        where: { id: session.id },
        data: { status: 'LIVE' },
      })
    }
    return row
  })

  const token = await mintJoinToken({
    roomName: session.livekitRoom,
    identity: participant.id,
    displayName: participant.displayName,
    role: 'guest',
    sessionId: session.id,
  })

  return {
    sessionId: session.id,
    participantId: participant.id,
    token,
    url: getLiveKitPublicUrl(),
  }
}
