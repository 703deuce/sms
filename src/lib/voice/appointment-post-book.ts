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
    const { loadVoiceAgentRuntimeConfigRecord } = await import("@/lib/voice/load-agent-config");
    const cfg = await loadVoiceAgentRuntimeConfigRecord(input.workspaceId, input.agentId);
    const messaging = (cfg.messaging || {}) as Record<string, unknown>;
    const smsOn =
      "smsConfirmations" in messaging
        ? Boolean(messaging.smsConfirmations)
        : (cfg.enabledBuiltinTools as string[] | undefined)?.includes("send_sms");
    if (smsOn) {
      try {
        const { sendQuickSms } = await import("@/lib/sms/send-quick");
        await sendQuickSms({
          workspaceId: input.workspaceId,
          to: normalizeE164(input.phone),
          body: `Your ${input.serviceName} appointment is confirmed for ${when}.`,
        });
        smsSent = true;
      } catch {
        // queued via verify path
      }
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
