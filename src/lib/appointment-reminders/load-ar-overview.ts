import "server-only";

import { getPrisma } from "@/lib/db";
import { loadAppointmentRemindersPage } from "@/lib/appointment-reminders/load-appointments-page";
import { loadAppointmentRemindersOperationalPage } from "@/lib/appointment-reminders/load-reminders-operational-page";
import {
  isCalendarConnectionLinked,
  isCalendarConnectionUsable,
} from "@/lib/appointment-reminders/calendar-connection";
import { loadAppointmentRemindersActivation } from "@/lib/appointment-reminders/activation";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";

export async function loadAppointmentRemindersOverview(workspaceId: string) {
  const prisma = getPrisma();
  const connections = await prisma.voiceCalendarConnection.findMany({
    where: { workspaceId, provider: { in: ["google", "microsoft"] } },
    select: { id: true, name: true, provider: true, status: true, lastSyncAt: true, config: true },
  });

  const activation = await loadAppointmentRemindersActivation(workspaceId);
  const platform = await loadAppointmentPlatformConfig(workspaceId);

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

  const hasImportCalendars = calendars.some((c) => (c.importCalendarCount ?? 0) > 0);
  const hasUsableConnection = connections.some((c) => isCalendarConnectionLinked(c.status));
  const syncHealthy = Boolean(todayPage.sync.connected) && !todayPage.sync.syncError;

  let smsSenderReady = false;
  try {
    const { getMerchantPaymentStatus } = await import("@/lib/merchant-payments/service");
    const merchantStatus = await getMerchantPaymentStatus(workspaceId);
    smsSenderReady = Boolean(
      merchantStatus &&
        (merchantStatus as { sms?: { ready?: boolean } }).sms?.ready !== false,
    );
  } catch {
    smsSenderReady = false;
  }

  const operationalStatus =
    activation.activatedAt && calendarHealthy && hasImportCalendars && syncHealthy && smsSenderReady
      ? "active"
      : calendarHealthy && hasImportCalendars
        ? "needs_attention"
        : "setup_incomplete";

  return {
    timezone: platform.timezone,
    setup: {
      calendarConnected: hasUsableConnection && hasImportCalendars,
    },
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
    readiness: {
      hasImportCalendars,
      syncHealthy,
      smsSenderReady,
      operationalStatus,
    },
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
