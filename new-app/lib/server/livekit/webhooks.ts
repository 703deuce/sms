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

  await prisma.recordingWebhookEvent.create({
    data: {
      id: createId('rwh'),
      livekitEventId: eventId,
      eventType: event.event ?? 'unknown',
      payload: JSON.parse(JSON.stringify(event)) as object,
    },
  })
}
