import "server-only";

import { getPrisma } from "@/lib/db";
import { providerRefFromAppointment } from "@/lib/appointment-reminders/ai-rescheduler/provider-mutations";
import { AR_REPLY_ELIGIBLE_STATES } from "./ar-platform-sender-pool";
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
  if (!AR_REPLY_ELIGIBLE_STATES.includes(session.lifecycleState as (typeof AR_REPLY_ELIGIBLE_STATES)[number])) {
    return { ok: false, reason: "session_not_reply_eligible" };
  }
  const now = new Date();
  if (session.replyEligibleUntil && session.replyEligibleUntil <= now) {
    return { ok: false, reason: "session_expired" };
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
