import "server-only";

import { getPrisma } from "@/lib/db";

export type AppointmentsAnalyticsRange = 7 | 30;

function normalize(status: string) {
  return status.toLowerCase().replace("cancelled", "canceled");
}

export async function loadAppointmentsAnalytics(
  workspaceId: string,
  rangeDays: AppointmentsAnalyticsRange = 7,
) {
  const prisma = getPrisma();
  const from = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

  const rows = await prisma.voiceAppointment.findMany({
    where: { workspaceId, startsAt: { gte: from } },
    select: { id: true, status: true, startsAt: true, metadata: true },
  });

  const booked = rows.length;
  const confirmed = rows.filter((r) => normalize(r.status) === "confirmed").length;
  const canceled = rows.filter((r) => normalize(r.status) === "canceled").length;
  const noShow = rows.filter((r) => normalize(r.status) === "no_show").length;
  const awaiting = rows.filter((r) =>
    ["awaiting_confirmation", "scheduled"].includes(normalize(r.status)),
  ).length;
  const rescheduleRequested = rows.filter(
    (r) => normalize(r.status) === "reschedule_requested",
  ).length;

  let remindersSent = 0;
  let remindersFailed = 0;
  for (const row of rows) {
    const timeline = ((row.metadata || {}) as { timeline?: Array<{ type: string }> }).timeline || [];
    for (const e of timeline) {
      if (e.type.endsWith("_sent") && e.type.includes("reminder")) remindersSent += 1;
      if (e.type.endsWith("_failed")) remindersFailed += 1;
      if (e.type === "confirmation_sent") remindersSent += 1;
    }
  }

  const confirmationRate =
    booked > 0 ? Math.round((confirmed / booked) * 100) : 0;

  const byDay = new Map<string, number>();
  for (const row of rows) {
    const key = row.startsAt.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) || 0) + 1);
  }
  const series = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return {
    rangeDays,
    booked,
    confirmed,
    awaiting,
    canceled,
    noShow,
    rescheduleRequested,
    confirmationRate,
    remindersSent,
    remindersFailed,
    series,
  };
}

export async function loadUpcomingAppointmentsByContactIds(
  workspaceId: string,
  contactIds: string[],
) {
  if (!contactIds.length) return new Map<string, { id: string; serviceName: string | null; startsAt: Date }>();
  const prisma = getPrisma();
  const rows = await prisma.voiceAppointment.findMany({
    where: {
      workspaceId,
      contactId: { in: contactIds },
      startsAt: { gte: new Date() },
      status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, contactId: true, serviceName: true, startsAt: true },
  });
  const map = new Map<string, { id: string; serviceName: string | null; startsAt: Date }>();
  for (const row of rows) {
    if (!row.contactId || map.has(row.contactId)) continue;
    map.set(row.contactId, {
      id: row.id,
      serviceName: row.serviceName,
      startsAt: row.startsAt,
    });
  }
  return map;
}
