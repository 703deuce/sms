import "server-only";

import { buildAppointmentsDirectory, type AppointmentDirectoryRow } from "@/lib/appointments/list/appointments-list-workspace";
import { countAppointments, listAppointments } from "@/lib/appointments/appointments-service";
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
import type { ArRescheduleRequestMeta } from "@/lib/appointment-reminders/ai-rescheduler/business-approval";
import { expireArRescheduleRequestIfNeeded } from "@/lib/appointment-reminders/ai-rescheduler/reschedule-request-lifecycle";
import { resolveArCustomerResponseSummary } from "@/lib/appointment-reminders/ar-sms-customer-outcome";

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
    customerResponse: resolveArCustomerResponseSummary({
      status: row.status,
      startsAt: row.startsAt,
      timezone: row.timezone,
      metadata: meta,
    }),
    sourceProvider: provider,
    sourceCalendarLabel: cal?.name || (meta.calendarId as string) || null,
    connectionId,
    status: row.status,
    sourceEventUrl: (meta.eventUrl as string) || null,
    arRescheduleRequest: meta.arRescheduleRequest
      ? expireArRescheduleRequestIfNeeded(meta.arRescheduleRequest as ArRescheduleRequestMeta)
      : undefined,
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

  const needsInMemoryFilter =
    Boolean(query.reminderStatus && query.reminderStatus !== "all") ||
    Boolean(query.calendarId && query.calendarId !== "all") ||
    Boolean(query.q?.trim());

  let directoryRows: AppointmentDirectoryRow[] = [];
  let dbPaginatedTotal: number | null = null;

  if (!needsInMemoryFilter) {
    const tabRange = range.tab === "past" ? { to: range.to ?? now } : { from: range.from ?? (range.tab === "upcoming" ? now : undefined), to: range.to };
    dbPaginatedTotal = await countAppointments(workspaceId, tabRange);
    const appts = await listAppointments(workspaceId, {
      ...tabRange,
      take: pageSize,
      skip: (page - 1) * pageSize,
    });
    directoryRows = appts
      .filter((a) => !a.id.startsWith("enroll:"))
      .map((a) => ({
        id: a.id,
        inviteeName: a.inviteeName,
        inviteePhone: a.inviteePhone,
        inviteeEmail: a.inviteeEmail,
        serviceName: a.serviceName,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
        status: a.status,
        timezone: a.timezone,
        reminderStatus: a.reminderStatus,
        contactId: a.contactId,
        domainType: "service",
        domainLabel: "Service",
        staffLabel: "",
        staffIds: [],
        locationId: null,
        locationLabel: null,
        resourceLabels: [],
        paymentLabel: null,
        balanceDueCents: 0,
        attentionFlags: [],
        attentionSummary: null,
        metadata: a.metadata as Record<string, unknown>,
        contact: a.contact ? { id: a.contact.id } : null,
      }));
  } else {
    const tabRange =
      range.tab === "past"
        ? { to: range.to ?? now }
        : {
            from: range.from ?? (range.tab === "upcoming" ? now : undefined),
            to: range.to,
          };
    const BATCH = 250;
    let skip = 0;
    const collected: AppointmentDirectoryRow[] = [];
    for (;;) {
      const appts = await listAppointments(workspaceId, {
        ...tabRange,
        q: query.q,
        take: BATCH,
        skip,
      });
      if (!appts.length) break;
      const batchRows: AppointmentDirectoryRow[] = appts
        .filter((a) => !a.id.startsWith("enroll:"))
        .map((a) => ({
          id: a.id,
          inviteeName: a.inviteeName,
          inviteePhone: a.inviteePhone,
          inviteeEmail: a.inviteeEmail,
          serviceName: a.serviceName,
          startsAt: a.startsAt,
          endsAt: a.endsAt,
          status: a.status,
          timezone: a.timezone,
          reminderStatus: a.reminderStatus,
          contactId: a.contactId,
          domainType: "service",
          domainLabel: "Service",
          staffLabel: "",
          staffIds: [],
          locationId: null,
          locationLabel: null,
          resourceLabels: [],
          paymentLabel: null,
          balanceDueCents: 0,
          attentionFlags: [],
          attentionSummary: null,
          metadata: a.metadata as Record<string, unknown>,
          contact: a.contact ? { id: a.contact.id } : null,
        }));
      collected.push(...batchRows);
      if (appts.length < BATCH) break;
      skip += BATCH;
    }
    directoryRows = collected;
  }

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
      (r) =>
        r.reminder.status === "needs_attention" ||
        r.reminder.status === "failed" ||
        r.arRescheduleRequest?.status === "pending_approval" ||
        r.arRescheduleRequest?.status === "pending_business",
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

  const total = dbPaginatedTotal ?? mapped.length;
  const pageRows = dbPaginatedTotal != null ? mapped : mapped.slice((page - 1) * pageSize, page * pageSize);

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
