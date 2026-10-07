import "server-only";

import { getPrisma } from "@/lib/db";
import { loadAppointmentRemindersPage } from "@/lib/appointment-reminders/load-appointments-page";
import { loadAppointmentRemindersOperationalPage } from "@/lib/appointment-reminders/load-reminders-operational-page";
import { isCalendarConnectionUsable } from "@/lib/appointment-reminders/calendar-connection";

export async function loadAppointmentRemindersOverview(workspaceId: string) {
  const prisma = getPrisma();
  const connections = await prisma.voiceCalendarConnection.findMany({
    where: { workspaceId, provider: { in: ["google", "microsoft"] } },
    select: { id: true, name: true, provider: true, status: true, lastSyncAt: true, config: true },
  });

  const [todayPage, upcomingPage, remindersPage] = await Promise.all([
    loadAppointmentRemindersPage(workspaceId, { date: "today", page: 1, pageSize: 500 }),
    loadAppointmentRemindersPage(workspaceId, { date: "upcoming", page: 1, pageSize: 1 }),
    loadAppointmentRemindersOperationalPage(workspaceId, { page: 1, pageSize: 8 }),
  ]);

  const calendars = connections.map((c) => {
    const config = (c.config || {}) as { email?: string; importCalendarIds?: string[] };
    return {
      id: c.id,
      provider: c.provider,
      status: c.status,
      lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
      label: c.name || c.provider,
      accountEmail: config.email || null,
      importCalendarCount: config.importCalendarIds?.length ?? 0,
    };
  });

  const calendarHealthy =
    calendars.length > 0 && calendars.every((c) => isCalendarConnectionUsable(c.status));

  return {
    counts: {
      todayTotal: todayPage.total,
      reminderFailed: remindersPage.summary.failed7d,
    },
    stats: {
      scheduledCount: upcomingPage.summary.scheduled,
      sentToday: remindersPage.summary.sentToday,
      failed7d: remindersPage.summary.failed7d,
    },
    calendars,
    calendarHealthy,
    sync: todayPage.sync,
    activity: remindersPage.rows.slice(0, 6).map((r) => ({
      id: r.id,
      at: r.occurredAt || r.scheduledFor || new Date().toISOString(),
      customerLabel: r.customerLabel,
      reminderLabel: r.reminderLabel,
      status: r.statusLabel,
    })),
  };
}
