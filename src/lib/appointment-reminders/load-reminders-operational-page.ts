import "server-only";

import { getPrisma } from "@/lib/db";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import {
  buildDedicatedReminderTimeline,
  buildFutureReminderSchedule,
} from "@/lib/appointments/reminder-engine";
import { listEnabledReminderSteps } from "@/lib/appointments/reminders/reminders-config";
import { resolveWeeklyHours } from "@/lib/appointments/availability-engine-policy";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { resolveReminderContactPhone } from "@/lib/appointment-reminders/aggregate-reminder-status";
import {
  eligibilityToBlockDetail,
  evaluateSmsReminderEligibility,
} from "@/lib/appointment-reminders/sms-eligibility";
import type {
  ArReminderOperationalRow,
  ArRemindersPagePayload,
  ArReminderOperationalStatus,
} from "@/lib/appointment-reminders/reminders-page-types";
import {
  isSmsReminderTimelineEvent,
  mapSmsReminderTimelineOutcome,
} from "@/lib/appointment-reminders/sms-reminder-timeline";

const SENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const FAILED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type ArRemindersQuery = {
  q?: string;
  status?: string;
  horizon?: string;
  page?: number;
  pageSize?: number;
};

function blockReason(
  meta: AppointmentMetadata,
  phone: string | null,
  appointmentStatus: string,
): { blocked: boolean; detail: string; hint: string } | null {
  const eligibility = evaluateSmsReminderEligibility({
    metadata: meta,
    inviteePhone: (meta.inviteePhone as string) || null,
    appointmentStatus,
  });
  return eligibilityToBlockDetail(eligibility);
}


function matchesFilter(row: ArReminderOperationalRow, status: string | undefined): boolean {
  if (!status || status === "all") return true;
  if (status === "needs_attention") {
    return row.status === "blocked" || row.status === "failed" || row.status === "past_due";
  }
  return row.status === status;
}

export async function loadAppointmentRemindersOperationalPage(
  workspaceId: string,
  query: ArRemindersQuery,
): Promise<ArRemindersPagePayload> {
  const now = Date.now();
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, query.pageSize ?? 25));
  const horizon = query.horizon || "all";

  const prisma = getPrisma();
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const weeklyHours = resolveWeeklyHours(platform);
  const steps = listEnabledReminderSteps(platform);

  const appointments = await prisma.voiceAppointment.findMany({
    where: { workspaceId },
    orderBy: { startsAt: "desc" },
    take: 1500,
    select: {
      id: true,
      serviceName: true,
      startsAt: true,
      status: true,
      metadata: true,
      timezone: true,
    },
  });

  const rows: ArReminderOperationalRow[] = [];

  for (const row of appointments) {
    const meta = (row.metadata || {}) as AppointmentMetadata;
    const customerLabel = (meta.inviteeName as string) || "Customer";
    const appointmentLabel = row.serviceName || "Appointment";
    const phone = resolveReminderContactPhone(meta, (meta.inviteePhone as string) || null);
    const block = blockReason(meta, phone, row.status);
    const inactive = ["canceled", "cancelled", "completed", "no_show"].includes(
      row.status.toLowerCase(),
    );

    const timeline = buildDedicatedReminderTimeline(meta);
    for (const ev of timeline) {
      if (!isSmsReminderTimelineEvent(ev.type)) continue;
      const occurredAt = ev.at || null;
      const outcome = mapSmsReminderTimelineOutcome(ev.type);
      const channel = "SMS";
      rows.push({
        id: `${row.id}-past-${ev.type}-${occurredAt || ""}`,
        appointmentId: row.id,
        customerLabel,
        appointmentLabel,
        reminderLabel: ev.label || ev.type,
        channel,
        scheduledFor: null,
        occurredAt,
        status: outcome.status,
        statusLabel: outcome.statusLabel,
        detail: ev.detail || null,
        actionHint: outcome.status === "failed" ? "Check sender registration and recipient phone" : null,
      });
    }

    if (inactive || row.startsAt.getTime() < now - 86400000) continue;

    const smsSteps = steps.filter((s) => s.step.channel === "sms");
    const future = buildFutureReminderSchedule({
      startsAt: row.startsAt.toISOString(),
      timezone: row.timezone || platform.timezone,
      steps: smsSteps.map((s) => ({ key: s.id, step: { ...s.step, minutesBefore: s.minutesBefore } })),
      metadata: meta,
      weeklyHours,
    });

    for (const step of future) {
      if (step.channel !== "sms") continue;
      if (step.status === "skipped" && !step.scheduledFor) continue;
      let status: ArReminderOperationalStatus = step.status as ArReminderOperationalStatus;
      let detail: string | null = null;
      let hint: string | null = null;
      let label = "Scheduled";

      if (block) {
        status = "blocked";
        label = "Blocked";
        detail = block.detail;
        hint = block.hint;
      } else if (status === "past_due") {
        label = "Needs attention";
        detail = "Scheduled send time has passed";
        hint = "Verify appointment time and reminder sequence";
      } else if (status === "scheduled") {
        label = "Scheduled";
      } else if (status === "sent") {
        label = "Sent";
        status = "sent";
      }

      if (horizon === "upcoming" && status !== "scheduled" && status !== "blocked" && status !== "past_due") {
        continue;
      }

      rows.push({
        id: `${row.id}-future-${step.stepKey}`,
        appointmentId: row.id,
        customerLabel,
        appointmentLabel,
        reminderLabel: step.label,
        channel: step.channel === "email" ? "Email" : step.channel === "voice" ? "Voice" : "SMS",
        scheduledFor: step.scheduledFor || null,
        occurredAt: null,
        status,
        statusLabel: label,
        detail,
        actionHint: hint,
      });
    }
  }

  const needle = query.q?.trim().toLowerCase();
  let filtered = rows;
  if (needle) {
    filtered = filtered.filter(
      (r) =>
        r.customerLabel.toLowerCase().includes(needle) ||
        r.appointmentLabel.toLowerCase().includes(needle) ||
        r.reminderLabel.toLowerCase().includes(needle),
    );
  }
  filtered = filtered.filter((r) => matchesFilter(r, query.status));

  filtered.sort((a, b) => {
    const ta = new Date(a.occurredAt || a.scheduledFor || 0).getTime();
    const tb = new Date(b.occurredAt || b.scheduledFor || 0).getTime();
    return tb - ta;
  });

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const summary = {
    scheduled: filtered.filter((r) => r.status === "scheduled").length,
    sentToday: filtered.filter((r) => {
      if (r.status !== "sent" && r.status !== "delivered") return false;
      if (!r.occurredAt) return false;
      return new Date(r.occurredAt) >= dayStart;
    }).length,
    sent30d: filtered.filter((r) => {
      if (r.status !== "sent" && r.status !== "delivered") return false;
      const t = r.occurredAt ? new Date(r.occurredAt).getTime() : 0;
      return t > 0 && now - t <= SENT_WINDOW_MS;
    }).length,
    failed7d: filtered.filter((r) => {
      if (r.status !== "failed") return false;
      const t = r.occurredAt ? new Date(r.occurredAt).getTime() : 0;
      return t > 0 && now - t <= FAILED_WINDOW_MS;
    }).length,
    blocked: filtered.filter((r) => r.status === "blocked" || r.status === "past_due").length,
  };

  const total = filtered.length;
  const startIdx = (page - 1) * pageSize;
  const pageRows = filtered.slice(startIdx, startIdx + pageSize);

  return {
    rows: pageRows,
    total,
    page,
    pageSize,
    summary,
    timezone: platform.timezone,
  };
}
