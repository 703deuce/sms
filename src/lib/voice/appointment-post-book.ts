import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";

export async function runPostBookSideEffects(input: {
  workspaceId: string;
  agentId?: string;
  callId?: string;
  appointmentId: string;
  name: string;
  phone: string;
  email: string;
  startsAt: string;
  serviceName: string;
}) {
  const when = input.startsAt || "the scheduled time";
  const body = [input.name, input.phone, `${input.serviceName} · ${when}`]
    .filter(Boolean)
    .join(" · ");

  await import("@/lib/notifications/in-app")
    .then(({ notifyWorkspace }) =>
      notifyWorkspace(input.workspaceId, {
        type: "system",
        title: "Appointment booked",
        body,
        href: input.callId ? `/voice/calls/${input.callId}` : "/voice/calls",
      }),
    )
    .catch(() => undefined);

  const prisma = getPrisma();
  const memberships = await prisma.membership.findMany({
    where: { workspaceId: input.workspaceId },
    include: { user: { select: { id: true, email: true } } },
  });
  for (const m of memberships) {
    const to = (m.user.email || "").trim().toLowerCase();
    if (!to) continue;
    await enqueueJob({
      jobType: "voice_send_email",
      queueName: "voice-calls",
      workspaceId: input.workspaceId,
      payload: {
        workspaceId: input.workspaceId,
        to,
        subject: `Appointment booked: ${input.serviceName}`,
        body: [body, input.email ? `Email: ${input.email}` : "", `Appointment ID: ${input.appointmentId}`]
          .filter(Boolean)
          .join("\n"),
        callId: input.callId,
        kind: "appointment_booked",
      },
      idempotencyKey: `voice-staff-email-appointment-${input.appointmentId}-${to}`,
    }).catch(() => undefined);
  }

  let smsSent = false;
  if (input.phone && input.agentId) {
    try {
      const { sendVoiceBookingConfirmationSms } = await import(
        "@/lib/voice/booking-confirmation-sms"
      );
      const result = await sendVoiceBookingConfirmationSms({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        callId: input.callId,
        to: normalizeE164(input.phone),
        startsAt: input.startsAt,
        serviceName: input.serviceName,
        idempotencyKey: `booking-confirm:${input.appointmentId}`,
      });
      smsSent = result.sent;
    } catch {
      // non-blocking for voice path
    }
  }

  const { verifyAppointmentBooking } = await import(
    "@/lib/agents/appointment-booking/verify-booking"
  );
  await verifyAppointmentBooking({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    callId: input.callId,
    smsAlreadySent: smsSent,
  }).catch(() => undefined);

  return { smsSent };
}
