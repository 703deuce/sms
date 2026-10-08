import "server-only";

import { getPrisma } from "@/lib/db";
import { providerRefFromAppointment } from "@/lib/appointment-reminders/ai-rescheduler/provider-mutations";
import { AR_INBOUND_ROUTABLE_LIFECYCLE_STATES } from "./persistent-conversation";
import type { ArSmsReplySession } from "@/lib/domain";

export async function verifyArReplySessionForInboundTurn(input: {
  sessionId: string;
  workspaceId: string;
  contactId: string;
  appointmentId: string;
}): Promise<
  | { ok: true; session: ArSmsReplySession }
  | { ok: false; reason: string }
> {
  const prisma = getPrisma();
  const session = await prisma.arSmsReplySession.findFirst({
    where: { id: input.sessionId, workspaceId: input.workspaceId },
  });
  if (!session) return { ok: false, reason: "session_not_found" };
  if (session.contactId !== input.contactId || session.appointmentId !== input.appointmentId) {
    return { ok: false, reason: "session_identity_mismatch" };
  }
  const routable = AR_INBOUND_ROUTABLE_LIFECYCLE_STATES.includes(
    session.lifecycleState as (typeof AR_INBOUND_ROUTABLE_LIFECYCLE_STATES)[number],
  );
  if (!routable) {
    return { ok: false, reason: "session_not_reply_eligible" };
  }

  const appt = await prisma.voiceAppointment.findFirst({
    where: {
      id: session.appointmentId,
      workspaceId: input.workspaceId,
      contactId: input.contactId,
    },
    select: {
      id: true,
      externalId: true,
      metadata: true,
      timezone: true,
      startsAt: true,
      endsAt: true,
    },
  });
  if (!appt) return { ok: false, reason: "appointment_not_found" };

  const providerRef = providerRefFromAppointment(appt);
  if (session.calendarConnectionId && providerRef?.connectionId !== session.calendarConnectionId) {
    return { ok: false, reason: "calendar_connection_mismatch" };
  }
  if (session.providerEventId && providerRef?.providerEventId !== session.providerEventId) {
    return { ok: false, reason: "provider_event_mismatch" };
  }

  return { ok: true, session };
}
