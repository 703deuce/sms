import "server-only";

import { getPrisma } from "@/lib/server/db";

export type CallHistoryStructuredFacts = {
  callerName?: string | null;
  callerPhone?: string | null;
  appointmentBooked?: boolean;
  appointmentService?: string | null;
  appointmentStart?: string | null;
  callbackRequested?: boolean;
  callbackReason?: string | null;
  transferred?: boolean;
  transferDestination?: string | null;
  bookingLinkSent?: boolean;
  outcomeLabel?: string | null;
};

export async function loadDeterministicCallFacts(
  callId: string,
  workspaceId: string,
): Promise<CallHistoryStructuredFacts> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: callId, workspaceId },
    select: {
      fromE164: true,
      outcome: true,
      appointmentBooked: true,
      transferred: true,
      contactId: true,
    },
  });
  if (!call) return {};

  const contact = call.contactId
    ? await prisma.contact.findFirst({
        where: { id: call.contactId, workspaceId },
        select: { firstName: true, lastName: true, phone: true },
      })
    : null;
  const appointments =
    (await prisma.voiceAppointment.findMany({
      where: { callId, workspaceId },
      orderBy: { createdAt: "desc" },
      take: 1,
      select: { serviceName: true, startsAt: true, status: true },
    })) ?? [];
  const transfers =
    (await prisma.voiceTransfer.findMany({
      where: { callId, workspaceId },
      orderBy: { createdAt: "desc" },
      take: 1,
    })) ?? [];

  const callerName = contact
    ? [contact.firstName, contact.lastName].filter(Boolean).join(" ")
    : null;
  const appt = appointments[0];
  const transfer = transfers[0];
  const outcome = String(call.outcome || "").toLowerCase();

  return {
    callerName,
    callerPhone: call.fromE164 || contact?.phone || null,
    appointmentBooked: call.appointmentBooked,
    appointmentService: appt?.serviceName ?? null,
    appointmentStart: appt?.startsAt?.toISOString() ?? null,
    callbackRequested: outcome.includes("callback"),
    transferred: call.transferred,
    transferDestination: transfer?.destination ?? null,
    bookingLinkSent: outcome.includes("booking_link"),
    outcomeLabel: call.outcome,
  };
}
