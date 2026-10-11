import "server-only";

import { getPrisma } from "@/lib/db";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import type { CalendarConfig } from "@/lib/calendar/providers";

export async function notifyArStaffOfReminderDeliveryFailure(input: {
  workspaceId: string;
  appointmentId: string;
  timelineType: string;
  detail: string;
}) {
  const prisma = getPrisma();
  const [appointment, platform, workspace] = await Promise.all([
    prisma.voiceAppointment.findFirst({
      where: { id: input.appointmentId, workspaceId: input.workspaceId },
      select: { serviceName: true, startsAt: true, metadata: true },
    }),
    loadAppointmentPlatformConfig(input.workspaceId),
    prisma.workspace.findUnique({
      where: { id: input.workspaceId },
      select: { name: true, displayName: true },
    }),
  ]);
  if (!appointment) return;

  const meta = (appointment.metadata || {}) as Record<string, unknown>;
  const connectionId = meta.connectionId as string | undefined;
  let notifyEmail: string | null = null;
  let notifyPhone: string | null = null;

  if (connectionId) {
    const conn = await prisma.voiceCalendarConnection.findFirst({
      where: { id: connectionId, workspaceId: input.workspaceId },
      select: { config: true },
    });
    const cfg = (conn?.config || {}) as CalendarConfig;
    notifyEmail = cfg.reminderDefaults?.replyDestinationEmail?.trim() || cfg.email?.trim() || null;
    notifyPhone = cfg.reminderDefaults?.replyDestinationPhone?.trim() || null;
  }

  notifyEmail =
    notifyEmail ||
    platform.reminderEmailBranding?.replyToEmail?.trim() ||
    platform.reminderEmailBranding?.contactEmail?.trim() ||
    null;

  const businessName = workspace?.displayName || workspace?.name || "Your business";
  const subject = `[Appointment Reminders] Delivery failed — ${appointment.serviceName || "appointment"}`;
  const body = [
    `${businessName}: an automated reminder could not be delivered.`,
    "",
    `Appointment: ${appointment.serviceName || "Appointment"}`,
    `When: ${appointment.startsAt.toISOString()}`,
    `Step: ${input.timelineType}`,
    `Reason: ${input.detail}`,
    "",
    `Open Appointments in Transovo to review: /appointment-reminders/appointments`,
  ].join("\n");

  if (notifyEmail) {
    try {
      const { sendTransactionalEmail } = await import("@/lib/email/brevo");
      await sendTransactionalEmail({
        to: notifyEmail,
        subject,
        textContent: body,
        htmlContent: body.replace(/\n/g, "<br/>"),
      });
    } catch (err) {
      console.warn("[ar] staff delivery failure email failed", input.workspaceId, err);
    }
  }

  if (notifyPhone) {
    try {
      const { sendInternationalAppointmentSms } = await import("@/lib/appointments/sms-sender");
      await sendInternationalAppointmentSms({
        workspaceId: input.workspaceId,
        to: notifyPhone,
        body: `[Transovo] Reminder delivery failed for ${appointment.serviceName || "an appointment"}. ${input.detail}`,
      });
    } catch (err) {
      console.warn("[ar] staff delivery failure SMS failed", input.workspaceId, err);
    }
  }
}
