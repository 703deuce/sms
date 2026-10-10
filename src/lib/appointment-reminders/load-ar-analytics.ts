import "server-only";

import { getPrisma } from "@/lib/db";

export type ArAnalyticsRange = {
  from: Date;
  to: Date;
};

export async function loadAppointmentRemindersAnalytics(
  workspaceId: string,
  range: ArAnalyticsRange,
) {
  const prisma = getPrisma();
  const { from, to } = range;

  const dispatches = await prisma.arReminderDispatch.findMany({
    where: {
      workspaceId,
      createdAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      status: true,
      timelineType: true,
      intendedFireAt: true,
      appointmentId: true,
      metadata: true,
    },
  });

  const byStatus: Record<string, number> = {};
  const byChannel: Record<string, number> = {};
  const byStep: Record<string, number> = {};
  for (const d of dispatches) {
    byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    const meta = (d.metadata || {}) as { channel?: string; stepKey?: string };
    const ch = meta.channel || (d.timelineType.includes("email") ? "email" : "sms");
    byChannel[ch] = (byChannel[ch] || 0) + 1;
    const step = meta.stepKey || d.timelineType;
    byStep[step] = (byStep[step] || 0) + 1;
  }

  const appointments = await prisma.voiceAppointment.findMany({
    where: {
      workspaceId,
      startsAt: { gte: from, lte: to },
    },
    select: { id: true, status: true, metadata: true, serviceName: true },
  });

  const byAppointmentStatus: Record<string, number> = {};
  const byService: Record<string, number> = {};
  let confirmationResponses = 0;
  let cancelRequests = 0;
  let rescheduleRequests = 0;
  let needsAttention = 0;

  for (const a of appointments) {
    const st = (a.status || "scheduled").toLowerCase();
    byAppointmentStatus[st] = (byAppointmentStatus[st] || 0) + 1;
    const svc = a.serviceName || "Unspecified";
    byService[svc] = (byService[svc] || 0) + 1;
    const meta = (a.metadata || {}) as Record<string, unknown>;
    if (st === "confirmed" || meta.arCustomerConfirmedAt) confirmationResponses += 1;
    if (st === "reschedule_requested") rescheduleRequests += 1;
    if (st === "canceled" || st === "cancelled") cancelRequests += 1;
    if (meta.reminderSmsEligible === false || meta.remindersSuppressed) needsAttention += 1;
  }

  const sent = (byStatus.delivered || 0) + (byStatus.sent || 0);
  const failed = (byStatus.failed || 0) + (byStatus.unknown || 0);
  const scheduled = (byStatus.pending || 0) + (byStatus.claimed || 0) + (byStatus.submitting || 0);
  const suppressed = byStatus.suppressed || 0;

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    reminders: {
      total: dispatches.length,
      scheduled,
      sent,
      delivered: byStatus.delivered || 0,
      failed,
      suppressed,
      byChannel,
      byStep,
      byStatus,
    },
    appointments: {
      total: appointments.length,
      byStatus: byAppointmentStatus,
      byService,
      confirmationResponses,
      cancelRequests,
      rescheduleRequests,
      needsAttention,
      noShow: byAppointmentStatus.no_show || 0,
      attended: byAppointmentStatus.completed || 0,
    },
  };
}
