import 'server-only'
import type { WebhookEvent } from 'livekit-server-sdk'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'

/** Idempotent LiveKit webhook handler (M15+ billing/reconcile expands here). */
export async function handleLivekitEvent(event: WebhookEvent): Promise<void> {
  const eventId = event.id ?? createId('lkwh')
  const prisma = getPrisma()
  const existing = await prisma.recordingWebhookEvent.findUnique({
    where: { livekitEventId: eventId },
    select: { id: true },
  })
  if (existing) return

  const roomName = event.room?.name
  let sessionId: string | null = null
  if (roomName?.startsWith('rec_')) {
    const sid = roomName.slice(4)
    const session = await prisma.recordingSession.findFirst({
      where: { OR: [{ id: sid }, { livekitRoom: roomName }] },
      select: { id: true },
    })
    sessionId = session?.id ?? null
  }

  await prisma.recordingWebhookEvent.create({
    data: {
      id: createId('rwh'),
      livekitEventId: eventId,
      eventType: event.event ?? 'unknown',
      payload: JSON.parse(JSON.stringify(event)) as object,
      sessionId,
    },
  })

  if (!sessionId) return

  const eventType = event.event ?? ''
  if (eventType === 'room_started' && event.room?.sid) {
    await prisma.recordingSession.updateMany({
      where: { id: sessionId },
      data: {
        livekitRoomSid: event.room.sid,
        liveStartedAt: event.createdAt ? new Date(Number(event.createdAt) * 1000) : new Date(),
        status: 'LIVE',
      },
    })
  }
  if (eventType === 'room_finished') {
    await prisma.recordingSession.updateMany({
      where: { id: sessionId, status: { in: ['DRAFT', 'LIVE'] } },
      data: { status: 'ENDED', liveEndedAt: new Date() },
    })
  }
  if (eventType === 'participant_joined' && event.participant?.identity) {
    await prisma.recordingParticipant.updateMany({
      where: { id: event.participant.identity, sessionId },
      data: {
        livekitSid: event.participant.sid ?? undefined,
        status: 'LIVE',
      },
    })
  }
  if (eventType === 'participant_left' && event.participant?.identity) {
    await prisma.recordingParticipant.updateMany({
      where: { id: event.participant.identity, sessionId },
      data: { status: 'LEFT' },
    })
  }
}
