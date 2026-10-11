import "server-only";

import { getPrisma } from "@/lib/db";
import { loadAppointmentRemindersPage } from "@/lib/appointment-reminders/load-appointments-page";
import { loadAppointmentRemindersOperationalPage } from "@/lib/appointment-reminders/load-reminders-operational-page";
import {
  isCalendarConnectionLinked,
  isCalendarConnectionUsable,
} from "@/lib/appointment-reminders/calendar-connection";
import { loadAppointmentRemindersActivation } from "@/lib/appointment-reminders/activation";
import { loadRecentArCustomerResponses } from "@/lib/appointment-reminders/load-recent-customer-responses";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { loadArNeedsAttentionRows } from "@/lib/appointment-reminders/load-ar-needs-attention";
import { evaluateAppointmentRemindersSetupReadiness } from "@/lib/appointment-reminders/activation";
import { isArRemindersPaused } from "@/lib/appointment-reminders/ar-operational-pause";
import { AR_ROUTES, AR_SETTINGS_INTEGRATIONS } from "@/lib/appointment-reminders/routes";

export async function loadAppointmentRemindersOverview(workspaceId: string) {
  const prisma = getPrisma();
  const connections = await prisma.voiceCalendarConnection.findMany({
    where: { workspaceId, provider: { in: ["google", "microsoft"] } },
    select: { id: true, name: true, provider: true, status: true, lastSyncAt: true, config: true },
  });

  const activation = await loadAppointmentRemindersActivation(workspaceId);
  const platform = await loadAppointmentPlatformConfig(workspaceId);

  const [
    todayPage,
    upcomingPage,
    upcomingSample,
    remindersPage,
    customerResponses,
    needsAttentionRows,
    setupReadiness,
  ] = await Promise.all([
    loadAppointmentRemindersPage(workspaceId, { date: "today", page: 1, pageSize: 500 }),
    loadAppointmentRemindersPage(workspaceId, { date: "upcoming", page: 1, pageSize: 1 }),
    loadAppointmentRemindersPage(workspaceId, { date: "upcoming", page: 1, pageSize: 250 }),
    loadAppointmentRemindersOperationalPage(workspaceId, { page: 1, pageSize: 8 }),
    loadRecentArCustomerResponses(workspaceId, 5),
    loadArNeedsAttentionRows(workspaceId, 20),
    evaluateAppointmentRemindersSetupReadiness(workspaceId),
  ]);

  let awaitingConfirmation = 0;
  let confirmedAppointments = 0;
  let needsAttentionCount = 0;
  for (const row of upcomingSample.rows) {
    const kind = row.customerResponse.kind;
    const status = String(row.status || "").toLowerCase();
    if (kind === "awaiting_reply" || status === "awaiting_confirmation") awaitingConfirmation += 1;
    if (kind === "confirmed" || status === "confirmed") confirmedAppointments += 1;
    if (
      row.reminder.status === "needs_attention" ||
      row.reminder.status === "failed" ||
      row.phoneState !== "ok" ||
      kind === "cancel_pending" ||
      kind === "reschedule_pending"
    ) {
      needsAttentionCount += 1;
    }
  }

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

  const hasImportCalendars = calendars.some((c) => (c.importCalendarCount ?? 0) > 0);
  const hasUsableConnection = connections.some((c) => isCalendarConnectionLinked(c.status));
  const syncHealthy = Boolean(todayPage.sync.connected) && !todayPage.sync.syncError;

  const importingCalendars = calendars.filter((c) => (c.importCalendarCount ?? 0) > 0);
  const calendarHealthy =
    importingCalendars.length > 0 &&
    importingCalendars.every((c) => isCalendarConnectionUsable(c.status)) &&
    syncHealthy;

  const smsSenderReady = setupReadiness.smsSenderReady;
  const emailSenderReady = setupReadiness.emailSenderReady;
  const remindersActivated = setupReadiness.activated;

  const remindersPaused = isArRemindersPaused(platform);

  const scheduledSendRows = upcomingSample.rows.filter(
    (row) =>
      row.reminder.status === "scheduled" &&
      row.reminder.attentionReason !== "workflow_conflict" &&
      !/^workflow active$/i.test(row.reminder.label),
  );

  const replyCount = upcomingSample.rows.filter((row) => row.customerResponse.kind !== "none").length;

  const operationalStatus = remindersPaused
    ? "needs_attention"
    : activation.activatedAt && calendarHealthy && hasImportCalendars && syncHealthy && smsSenderReady
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
      upcoming: upcomingPage.total,
      awaitingConfirmation,
      confirmed: confirmedAppointments,
      needsAttention: needsAttentionCount,
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
      emailSenderReady,
      remindersActivated,
      remindersPaused,
      operationalPause: platform.appointmentReminders?.operationalPause ?? null,
      operationalStatus,
    },
    productStatus: [
      {
        id: "calendar",
        label: "Microsoft calendar",
        status: setupReadiness.calendarConnected && setupReadiness.hasImportCalendars ? "ready" : "needs_setup",
        detail:
          setupReadiness.calendarConnected && setupReadiness.hasImportCalendars
            ? "Connected"
            : "Connect and select import calendars",
        href: AR_SETTINGS_INTEGRATIONS,
      },
      {
        id: "sms",
        label: "SMS readiness",
        status: smsSenderReady ? "ready" : "needs_setup",
        detail: smsSenderReady
          ? setupReadiness.smsSenderDetail || "Sender ready"
          : setupReadiness.smsSenderDetail || "Platform SMS sender not ready",
        href: `${AR_ROUTES.settings}?tab=notifications`,
      },
      {
        id: "email",
        label: "Email readiness",
        status: emailSenderReady ? "ready" : "needs_setup",
        detail: emailSenderReady
          ? "Ready to send"
          : setupReadiness.emailSenderDetail || "Configure email delivery",
        href: `${AR_ROUTES.settings}?tab=notifications`,
      },
      {
        id: "activation",
        label: "Reminder activation",
        status: remindersActivated ? "ready" : "needs_setup",
        detail: remindersActivated ? "Active" : "Finish setup and activate",
        href: AR_ROUTES.setupActivate,
      },
      {
        id: "sync",
        label: "Last calendar sync",
        status: syncHealthy && setupReadiness.lastSyncAt ? "ready" : "needs_setup",
        detail: setupReadiness.lastSyncAt
          ? new Date(setupReadiness.lastSyncAt).toLocaleString()
          : "Not synced yet",
        href: AR_ROUTES.appointments,
      },
    ],
    sync: todayPage.sync,
    needsAttentionRows,
    operationalSummary: {
      rangeLabel: "Upcoming appointments",
      appointments: upcomingPage.total,
      scheduledSends: upcomingPage.summary.scheduled,
      replies: replyCount,
      attention: needsAttentionCount,
    },
    upcomingScheduledSends: scheduledSendRows.slice(0, 6).map((row) => ({
      appointmentId: row.id,
      customerName: row.customerName,
      appointmentTitle: row.appointmentTitle,
      startsAt: row.startsAt,
      channel: "SMS",
      stepLabel: row.reminder.label,
      sendAtLabel: row.reminder.secondaryLine || row.reminder.label,
      detail: row.reminder.secondaryLine,
    })),
    upcomingAppointments: upcomingSample.rows.slice(0, 8).map((row) => ({
      appointmentId: row.id,
      customerName: row.customerName,
      appointmentTitle: row.appointmentTitle,
      startsAt: row.startsAt,
      nextReminder: row.reminder.label,
      reminderSecondary: row.reminder.secondaryLine,
      reminderStatus: row.reminder.status,
      reminderAttentionReason: row.reminder.attentionReason,
      responseStatus: row.customerResponse.label,
      responseKind: row.customerResponse.kind,
    })),
    activity: remindersPage.rows.slice(0, 8).map((r) => ({
      id: r.id,
      appointmentId: r.appointmentId,
      at: r.occurredAt || r.scheduledFor || new Date().toISOString(),
      recipient: r.customerLabel,
      channel: r.channel,
      message: r.reminderLabel,
      customerLabel: r.customerLabel,
      reminderLabel: r.reminderLabel,
      status: r.statusLabel,
      detail: r.detail,
      actionHint: r.actionHint,
    })),
    customerResponses: customerResponses.map((r) => ({
      appointmentId: r.appointmentId,
      customerName: r.customerName,
      appointmentTitle: r.appointmentTitle,
      startsAt: r.startsAt,
      timezone: r.timezone,
      responseAt: r.responseAt,
      customerResponse: r.customerResponse,
    })),
  };
}
