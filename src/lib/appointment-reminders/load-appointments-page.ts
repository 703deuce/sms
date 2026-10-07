import "server-only";

import { buildAppointmentsDirectory, type AppointmentDirectoryRow } from "@/lib/appointments/list/appointments-list-workspace";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { getPrisma } from "@/lib/db";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import {
  matchesReminderStatusFilter,
  resolveReminderContactPhone,
  type AggregateReminderView,
} from "@/lib/appointment-reminders/aggregate-reminder-status";
import { computeAggregateReminderView } from "@/lib/appointment-reminders/aggregate-reminder-status.server";
import { isCalendarConnectionUsable } from "@/lib/appointment-reminders/calendar-connection";
import { resolveArAppointmentContactDisplay } from "@/lib/appointment-reminders/contact-display";

export type ArAppointmentsQuery = {
  q?: string;
  date?: string;
  reminderStatus?: string;
  calendarId?: string;
  page?: number;
  pageSize?: number;
};

export type { ArAppointmentRow, ArAppointmentsPagePayload } from "@/lib/appointment-reminders/appointments-page-types";
import type { ArAppointmentRow, ArAppointmentsPagePayload } from "@/lib/appointment-reminders/appointments-page-types";

function dateRangeFromFilter(filter: string | undefined, now: Date): { tab?: string; from?: Date; to?: Date } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  switch (filter) {
    case "today":
      return { from: start, to: end };
    case "next7": {
      const to = new Date(now);
      to.setDate(to.getDate() + 7);
      return { from: now, to };
    }
    case "next30": {
      const to = new Date(now);
      to.setDate(to.getDate() + 30);
      return { from: now, to };
    }
    case "past":
      return { tab: "past" };
    case "all":
      return { tab: "all" };
    case "upcoming":
    default:
      return { tab: "upcoming" };
  }
}

function mapRow(
  row: AppointmentDirectoryRow,
  platform: Awaited<ReturnType<typeof loadAppointmentPlatformConfig>>,
  calendarNames: Map<string, { name: string; provider: string }>,
): ArAppointmentRow {
  const meta = row.metadata as AppointmentMetadata;
  const reminder = computeAggregateReminderView({
    status: row.status,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    timezone: row.timezone,
    inviteePhone: row.inviteePhone,
    metadata: meta,
    platform,
  });
  const contact = resolveArAppointmentContactDisplay(
    meta,
    row.inviteeName,
    row.inviteePhone,
    row.serviceName,
  );
  const phone = contact.phone;
  const phoneState =
    contact.phoneState === "email_only"
      ? "missing"
      : contact.phoneState === "invalid" || reminder.attentionReason === "invalid_phone"
        ? "invalid"
        : contact.phoneState === "ok"
          ? "ok"
          : "missing";

  const connectionId = (meta.connectionId as string) || null;
  const cal = connectionId ? calendarNames.get(connectionId) : undefined;
  const provider = (meta.provider as string) || cal?.provider || null;

  return {
    id: row.id,
    customerName: contact.customerName,
    appointmentTitle: contact.appointmentTitle,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    timezone: row.timezone,
    isAllDay: Boolean(meta.isAllDay),
    phone,
    phoneState,
    contactEmail: contact.email,
    reminder,
    sourceProvider: provider,
    sourceCalendarLabel: cal?.name || (meta.calendarId as string) || null,
    connectionId,
    status: row.status,
    sourceEventUrl: (meta.eventUrl as string) || null,
  };
}

function isUpcomingActive(row: ArAppointmentRow, now: Date): boolean {
  if (["canceled", "cancelled", "completed", "no_show"].includes(row.status.toLowerCase())) {
    return false;
  }
  return new Date(row.startsAt) >= now;
}

const SENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export async function loadAppointmentRemindersPage(
  workspaceId: string,
  query: ArAppointmentsQuery,
): Promise<ArAppointmentsPagePayload> {
  const now = new Date();
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, query.pageSize ?? 25));
  const range = dateRangeFromFilter(query.date, now);

  const prisma = getPrisma();
  type CalendarConnectionRow = {
    id: string;
    name: string | null;
    provider: string;
    status: string;
    lastSyncAt: Date | null;
    config: unknown;
  };

  const [platform, connections] = await Promise.all([
    loadAppointmentPlatformConfig(workspaceId),
    prisma.voiceCalendarConnection.findMany({
      where: { workspaceId, provider: { in: ["google", "microsoft"] } },
      select: { id: true, name: true, provider: true, status: true, lastSyncAt: true, config: true },
    }) as Promise<CalendarConnectionRow[]>,
  ]);

  const calendarNames = new Map<string, { name: string; provider: string }>(
    connections.map((c: CalendarConnectionRow) => [
      c.id,
      { name: c.name || c.provider, provider: c.provider },
    ]),
  );

  const { rows: directoryRows } = await buildAppointmentsDirectory(workspaceId, {
    tab: range.tab,
    from: range.from,
    to: range.to,
    q: query.q,
    take: 500,
  });

  let mapped = directoryRows
    .filter((r) => !r.id.startsWith("enroll:"))
    .map((r) => mapRow(r, platform, calendarNames));

  if (query.calendarId && query.calendarId !== "all") {
    mapped = mapped.filter((r) => r.connectionId === query.calendarId);
  }

  if (query.reminderStatus && query.reminderStatus !== "all") {
    mapped = mapped.filter((r) => matchesReminderStatusFilter(r.reminder, query.reminderStatus!));
  }

  const upcomingRows = mapped.filter((r) => isUpcomingActive(r, now));
  const summary = {
    upcoming: upcomingRows.length,
    scheduled: upcomingRows.filter((r) => r.reminder.status === "scheduled").length,
    sent: mapped.filter((r) => {
      if (r.reminder.status !== "sent" && r.reminder.status !== "delivered") return false;
      const t = r.reminder.secondaryLine;
      if (!t) return true;
      return true;
    }).length,
    needsAttention: upcomingRows.filter(
      (r) => r.reminder.status === "needs_attention" || r.reminder.status === "failed",
    ).length,
  };

  // Sent: distinct appointments with sent/delivered in last 30 days (approx via status)
  summary.sent = mapped.filter((r) => {
    if (r.reminder.status !== "sent" && r.reminder.status !== "delivered") return false;
    const meta = directoryRows.find((d) => d.id === r.id)?.metadata as AppointmentMetadata;
    const timeline = meta?.timeline || [];
    const lastSent = timeline
      .filter((e) => e.type.includes("sent") || e.type.includes("delivered"))
      .map((e) => (e.at ? new Date(e.at).getTime() : 0))
      .sort((a, b) => b - a)[0];
    if (!lastSent) return true;
    return now.getTime() - lastSent <= SENT_WINDOW_MS;
  }).length;

  const total = mapped.length;
  const startIdx = (page - 1) * pageSize;
  const pageRows = mapped.slice(startIdx, startIdx + pageSize);

  const connected = connections.some((c) => isCalendarConnectionUsable(c.status));
  const lastSyncAt = connections
    .map((c) => c.lastSyncAt)
    .filter(Boolean)
    .sort((a, b) => (b!.getTime() > a!.getTime() ? 1 : -1))[0];

  const syncError = connections
    .map((c) => (c.config as { lastSyncError?: string })?.lastSyncError)
    .find(Boolean);

  return {
    rows: pageRows,
    total,
    page,
    pageSize,
    summary,
    sync: {
      connected,
      lastSyncAt: lastSyncAt?.toISOString() ?? null,
      syncError: syncError ?? null,
    },
    calendars: connections.map((c) => ({
      id: c.id,
      label: c.name || c.provider,
      provider: c.provider,
    })),
    timezone: platform.timezone,
  };
}
