import "server-only";

import { getPrisma } from "@/lib/db";
import type { VoiceV2StructuredOutcome } from "./booking-strategy";

export type VoiceV2BusinessRequestPayload = {
  workspaceId: string;
  callId?: string | null;
  outcome: VoiceV2StructuredOutcome;
  callerName?: string;
  callerPhone?: string;
  serviceReason?: string;
  schedulingSummary?: string;
  customFields?: Record<string, string>;
  summary?: string;
  messageEmail?: string | null;
  messageSms?: string | null;
};

function deliveryKey(outcome: string, channel: string, recipient: string): string {
  return `voiceV2Notify:${outcome}:${channel}:${recipient}`;
}

async function alreadyDelivered(
  callId: string,
  workspaceId: string,
  key: string,
): Promise<boolean> {
  const prisma = getPrisma();
  const row = await prisma.voiceCall.findFirst({
    where: { id: callId, workspaceId },
    select: { metadata: true },
  });
  const meta = (row?.metadata || {}) as Record<string, unknown>;
  const delivered = meta.voiceV2NotificationDeliveries as Record<string, boolean> | undefined;
  return Boolean(delivered?.[key]);
}

async function markDelivered(callId: string, workspaceId: string, key: string): Promise<void> {
  const prisma = getPrisma();
  const row = await prisma.voiceCall.findFirst({
    where: { id: callId, workspaceId },
    select: { metadata: true },
  });
  const prev = (row?.metadata || {}) as Record<string, unknown>;
  const delivered = {
    ...((prev.voiceV2NotificationDeliveries as Record<string, boolean>) || {}),
    [key]: true,
  };
  await prisma.voiceCall.update({
    where: { id: callId },
    data: {
      metadata: {
        ...prev,
        voiceV2NotificationDeliveries: delivered,
      },
    },
  });
}

export async function deliverVoiceV2BusinessRequestNotifications(
  input: VoiceV2BusinessRequestPayload,
): Promise<void> {
  const name = input.callerName?.trim() || "Caller";
  const phone = input.callerPhone?.trim() || "";
  const reason = input.serviceReason?.trim() || "";
  const pref = input.schedulingSummary?.trim() || "";
  const isAppointment = input.outcome === "APPOINTMENT_REQUESTED";
  const isBookingLink = input.outcome === "BOOKING_LINK_SENT";

  const subject = isBookingLink
    ? `Booking link sent — ${name}`
    : isAppointment
      ? `New appointment request from ${name}`
      : `New message from ${name}`;

  const statusLine = isBookingLink
    ? "Booking link sent to caller — NOT an appointment booking"
    : isAppointment
      ? "Appointment requested — NOT YET CONFIRMED"
      : "Message taken — follow up with caller";

  const bodyLines = [
    `Caller: ${name}`,
    phone ? `Phone: ${phone}` : null,
    reason ? `Reason: ${reason}` : null,
    pref ? `Requested: ${pref}` : null,
    input.customFields
      ? Object.entries(input.customFields)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n")
      : null,
    `Status: ${statusLine}`,
    input.summary ? `Summary:\n${input.summary}` : null,
  ].filter(Boolean);

  const email = input.messageEmail?.trim();
  if (email && input.callId) {
    const key = deliveryKey(input.outcome, "email", email);
    if (!(await alreadyDelivered(input.callId, input.workspaceId, key))) {
      try {
        const { sendTransactionalEmail } = await import("@/lib/email/brevo");
        await sendTransactionalEmail({
          to: [{ email }],
          subject,
          textContent: bodyLines.join("\n"),
        });
        await markDelivered(input.callId, input.workspaceId, key);
      } catch {
        // async path — do not block caller
      }
    }
  }

  // SMS business notifications reuse wizard notification destinations when a shared
  // transactional SMS helper is wired; email delivery above is required for this pass.
  void input.messageSms;
}
