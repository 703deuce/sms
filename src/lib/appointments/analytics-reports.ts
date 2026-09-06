import "server-only";

import { getPrisma } from "@/lib/db";
import { loadAppointmentsAnalytics } from "@/lib/appointments/analytics";

export async function loadExtendedAppointmentsAnalytics(
  workspaceId: string,
  rangeDays: 7 | 30 | 90 = 30,
) {
  const prisma = getPrisma();
  const from = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
  const rows = await prisma.voiceAppointment.findMany({
    where: { workspaceId, startsAt: { gte: from } },
    select: {
      id: true,
      status: true,
      startsAt: true,
      serviceName: true,
      metadata: true,
      createdAt: true,
    },
  });

  const base = await loadAppointmentsAnalytics(workspaceId, rangeDays <= 30 ? (rangeDays as 7 | 30) : 30);
  const completed = rows.filter((r) => r.status.toLowerCase() === "completed").length;
  const booked = rows.length;
  const canceled = rows.filter((r) => ["canceled", "cancelled"].includes(r.status.toLowerCase())).length;
  const noShow = rows.filter((r) => r.status.toLowerCase() === "no_show").length;
  const rescheduled = rows.filter((r) =>
    ((r.metadata || {}) as { timeline?: Array<{ type: string }> }).timeline?.some((t) =>
      t.type.includes("reschedule"),
    ),
  ).length;
  const confirmed = rows.filter((r) => r.status.toLowerCase() === "confirmed").length;

  const byType = new Map<string, number>();
  const byHour = new Map<number, number>();
  let emailOpens = 0;
  let emailClicks = 0;
  let smsResponses = 0;

  for (const row of rows) {
    const type = row.serviceName || "Unknown";
    byType.set(type, (byType.get(type) || 0) + 1);
    byHour.set(row.startsAt.getHours(), (byHour.get(row.startsAt.getHours()) || 0) + 1);
    const meta = (row.metadata || {}) as {
      emailTracking?: Record<string, { opens?: number; clicks?: number }>;
      timeline?: Array<{ type: string }>;
    };
    for (const t of Object.values(meta.emailTracking || {})) {
      emailOpens += t.opens || 0;
      emailClicks += t.clicks || 0;
    }
    if (meta.timeline?.some((t) => t.type.includes("sms_reply") || t.type.includes("inbound"))) {
      smsResponses += 1;
    }
  }

  const popularTypes = [...byType.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
  const popularTimes = [...byHour.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([hour, count]) => ({ hour, count }));

  const utmConversions = rows.filter((r) => {
    const utm = ((r.metadata || {}) as { utm?: { source?: string } }).utm;
    return Boolean(utm?.source);
  }).length;

  return {
    ...base,
    completed,
    cancellationRate: booked > 0 ? Math.round((canceled / booked) * 100) : 0,
    noShowRate: booked > 0 ? Math.round((noShow / booked) * 100) : 0,
    rescheduleRate: booked > 0 ? Math.round((rescheduled / booked) * 100) : 0,
    confirmationRate: booked > 0 ? Math.round((confirmed / booked) * 100) : 0,
    popularTypes,
    popularTimes,
    emailOpens,
    emailClicks,
    smsResponses,
    utmConversions,
    conversionRate: booked > 0 ? Math.round((confirmed / booked) * 100) : 0,
  };
}

export function appointmentsToCsv(
  rows: Array<{
    id: string;
    serviceName: string | null;
    startsAt: Date;
    status: string;
    inviteeName?: string | null;
  }>,
): string {
  const header = "id,service,starts_at,status,invitee";
  const lines = rows.map(
    (r) =>
      `${r.id},"${(r.serviceName || "").replace(/"/g, '""')}",${r.startsAt.toISOString()},${r.status},"${(r.inviteeName || "").replace(/"/g, '""')}"`,
  );
  return [header, ...lines].join("\n");
}

export async function buildAppointmentPdfReport(workspaceId: string, rangeDays = 30): Promise<Buffer> {
  const analytics = await loadExtendedAppointmentsAnalytics(workspaceId, rangeDays as 30);
  const text = [
    "Transovo Appointments Report",
    `Range: last ${rangeDays} days`,
    "",
    `Booked: ${analytics.booked}`,
    `Completed: ${analytics.completed}`,
    `Confirmed rate: ${analytics.confirmationRate}%`,
    `Cancellation rate: ${analytics.cancellationRate}%`,
    `No-show rate: ${analytics.noShowRate}%`,
    `Reschedule rate: ${analytics.rescheduleRate}%`,
    `Reminders sent: ${analytics.remindersSent}`,
    `Email opens: ${analytics.emailOpens}`,
    `Email clicks: ${analytics.emailClicks}`,
    "",
    "Popular types:",
    ...analytics.popularTypes.map((t) => `  ${t.name}: ${t.count}`),
  ].join("\n");
  return Buffer.from(text, "utf8");
}

export async function scheduleEmailedReport(
  workspaceId: string,
  input: { email: string; cadence: "daily" | "weekly"; rangeDays?: number },
) {
  const { saveAppointmentPlatformConfig, loadAppointmentPlatformConfig } = await import(
    "@/lib/appointments/settings"
  );
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const schedules = (platform as { scheduledReports?: Array<typeof input & { id: string }> }).scheduledReports || [];
  const entry = { id: `sr_${Date.now()}`, ...input };
  await saveAppointmentPlatformConfig(workspaceId, { scheduledReports: [...schedules, entry] } as object);
  const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
  const runAfter = new Date(Date.now() + (input.cadence === "daily" ? 24 : 168) * 60 * 60 * 1000);
  await enqueueJob({
    jobType: "appointments_scheduled_report",
    workspaceId,
    payload: { reportId: entry.id },
    runAfter,
    idempotencyKey: `appt-report:${entry.id}`,
  });
  return entry;
}
