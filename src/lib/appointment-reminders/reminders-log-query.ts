import "server-only";

import { getPrisma } from "@/lib/db";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { buildFutureReminderSchedule } from "@/lib/appointments/reminder-engine";
import { listEnabledReminderSteps } from "@/lib/appointments/reminders/reminders-config";
import { resolveWeeklyHours } from "@/lib/appointments/availability-engine-policy";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { resolveReminderContactPhone } from "@/lib/appointment-reminders/aggregate-reminder-status";
import {
  describePlatformReminderWorkflowConflictFromContext,
  loadPlatformReminderWorkflowContext,
} from "@/lib/appointment-reminders/platform-reminder-workflow";
import {
  eligibilityToBlockDetail,
  evaluateSmsReminderEligibility,
} from "@/lib/appointment-reminders/sms-eligibility";
import type {
  ArReminderOperationalRow,
  ArReminderOperationalStatus,
} from "@/lib/appointment-reminders/reminders-page-types";
import {
  isSmsReminderTimelineEvent,
  mapSmsReminderTimelineOutcome,
} from "@/lib/appointment-reminders/sms-reminder-timeline";

const SENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const FAILED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type PastEventRow = {
  appointment_id: string;
  service_name: string | null;
  starts_at: Date;
  status: string;
  metadata: unknown;
  event_type: string;
  event_label: string | null;
  event_detail: string | null;
  event_at: string | null;
};

function blockReason(
  meta: AppointmentMetadata,
  phone: string | null,
  appointmentStatus: string,
  platform: Awaited<ReturnType<typeof loadAppointmentPlatformConfig>>,
  appointmentRemindersActivatedAt: string | null,
): { blocked: boolean; detail: string; hint: string } | null {
  const eligibility = evaluateSmsReminderEligibility({
    metadata: meta,
    inviteePhone: (meta.inviteePhone as string) || null,
    appointmentStatus,
    platform,
    appointmentRemindersActivatedAt,
  });
  return eligibilityToBlockDetail(eligibility);
}

function pastEventToRow(row: PastEventRow): ArReminderOperationalRow | null {
  if (!isSmsReminderTimelineEvent(row.event_type)) return null;
  const meta = (row.metadata || {}) as AppointmentMetadata;
  const customerLabel = (meta.inviteeName as string) || "Customer";
  const appointmentLabel = row.service_name || "Appointment";
  const outcome = mapSmsReminderTimelineOutcome(row.event_type);
  return {
    id: `${row.appointment_id}-past-${row.event_type}-${row.event_at || ""}`,
    appointmentId: row.appointment_id,
    customerLabel,
    appointmentLabel,
    reminderLabel: row.event_label || row.event_type,
    channel: "SMS",
    scheduledFor: null,
    occurredAt: row.event_at,
    status: outcome.status,
    statusLabel: outcome.statusLabel,
    detail: row.event_detail || null,
    actionHint: outcome.status === "failed" ? "Check sender registration and recipient phone" : null,
  };
}

function matchesFilter(row: ArReminderOperationalRow, status: string | undefined): boolean {
  if (!status || status === "all") return true;
  if (status === "needs_attention") {
    return row.status === "blocked" || row.status === "failed" || row.status === "past_due";
  }
  return row.status === status;
}

function matchesSearch(row: ArReminderOperationalRow, needle: string | undefined): boolean {
  if (!needle) return true;
  const n = needle.toLowerCase();
  return (
    row.customerLabel.toLowerCase().includes(n) ||
    row.appointmentLabel.toLowerCase().includes(n) ||
    row.reminderLabel.toLowerCase().includes(n)
  );
}

async function fetchPastSmsTimelineEvents(
  workspaceId: string,
  opts: { offset: number; limit: number; search?: string },
): Promise<{ rows: ArReminderOperationalRow[]; total: number }> {
  const prisma = getPrisma();
  const search = opts.search?.trim().toLowerCase();

  const countRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM voice_appointments va
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(va.metadata->'timeline', '[]'::jsonb)) AS ev(elem)
    WHERE va.workspace_id = ${workspaceId}
    AND (
      LOWER(ev.elem->>'type') LIKE '%reminder%'
      OR LOWER(ev.elem->>'type') LIKE '%confirmation%'
      OR LOWER(ev.elem->>'type') LIKE 'workflow_%'
      OR LOWER(ev.elem->>'type') LIKE '%sms%'
    )
    AND LOWER(ev.elem->>'type') NOT LIKE '%voice%'
    AND NOT (
      LOWER(ev.elem->>'type') LIKE '%email%'
      AND LOWER(ev.elem->>'type') NOT LIKE '%sms%'
    )
  `;

  const rawEvents = await prisma.$queryRaw<PastEventRow[]>`
    SELECT
      va.id AS appointment_id,
      va.service_name,
      va.starts_at,
      va.status,
      va.metadata,
      ev.elem->>'type' AS event_type,
      ev.elem->>'label' AS event_label,
      ev.elem->>'detail' AS event_detail,
      ev.elem->>'at' AS event_at
    FROM voice_appointments va
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(va.metadata->'timeline', '[]'::jsonb)) AS ev(elem)
    WHERE va.workspace_id = ${workspaceId}
    AND (
      LOWER(ev.elem->>'type') LIKE '%reminder%'
      OR LOWER(ev.elem->>'type') LIKE '%confirmation%'
      OR LOWER(ev.elem->>'type') LIKE 'workflow_%'
      OR LOWER(ev.elem->>'type') LIKE '%sms%'
    )
    AND LOWER(ev.elem->>'type') NOT LIKE '%voice%'
    AND NOT (
      LOWER(ev.elem->>'type') LIKE '%email%'
      AND LOWER(ev.elem->>'type') NOT LIKE '%sms%'
    )
    ORDER BY COALESCE(ev.elem->>'at', va.starts_at::text) DESC
    OFFSET ${opts.offset}
    LIMIT ${opts.limit}
  `;

  const mapped = rawEvents
    .map(pastEventToRow)
    .filter((r): r is ArReminderOperationalRow => r !== null)
    .filter((r) => matchesSearch(r, search));

  let total = Number(countRows[0]?.count ?? 0);
  if (search) {
    total = mapped.length;
  }

  return { rows: mapped, total };
}

async function fetchFutureScheduledRows(
  workspaceId: string,
  opts: { page: number; pageSize: number; search?: string; status?: string },
): Promise<{ rows: ArReminderOperationalRow[]; total: number }> {
  const now = Date.now();
  const prisma = getPrisma();
  const { loadAppointmentRemindersActivation } = await import(
    "@/lib/appointment-reminders/activation"
  );
  const [platform, activation] = await Promise.all([
    loadAppointmentPlatformConfig(workspaceId),
    loadAppointmentRemindersActivation(workspaceId),
  ]);
  const appointmentRemindersActivatedAt = activation.activatedAt ?? null;
  const weeklyHours = resolveWeeklyHours(platform);
  const steps = listEnabledReminderSteps(platform);
  const smsSteps = steps.filter((s) => s.step.channel === "sms" && !s.immediate);

  const search = opts.search?.trim().toLowerCase();
  const where: {
    workspaceId: string;
    startsAt: { gt: Date };
    status: { notIn: string[] };
    OR?: Array<{ serviceName?: { contains: string; mode: "insensitive" }; metadata?: unknown }>;
  } = {
    workspaceId,
    startsAt: { gt: new Date(now - 86400000) },
    status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
  };

  if (search) {
    where.OR = [
      { serviceName: { contains: search, mode: "insensitive" } },
    ];
  }

  const appointmentCount = await prisma.voiceAppointment.count({ where });
  const appointments = await prisma.voiceAppointment.findMany({
    where,
    orderBy: { startsAt: "asc" },
    skip: (opts.page - 1) * opts.pageSize,
    take: opts.pageSize,
    select: {
      id: true,
      serviceName: true,
      startsAt: true,
      status: true,
      metadata: true,
      timezone: true,
    },
  });

  const workflowCtx = await loadPlatformReminderWorkflowContext(workspaceId);
  const serviceRows = await prisma.voiceService.findMany({
    where: { workspaceId },
    select: { id: true, name: true },
  });
  const serviceNameToId = new Map(serviceRows.map((s) => [s.name, s.id]));

  const rows: ArReminderOperationalRow[] = [];
  for (const row of appointments) {
    const meta = (row.metadata || {}) as AppointmentMetadata;
    const customerLabel = (meta.inviteeName as string) || "Customer";
    if (search && !customerLabel.toLowerCase().includes(search)) {
      const svc = (row.serviceName || "").toLowerCase();
      if (!svc.includes(search)) continue;
    }
    const appointmentLabel = row.serviceName || "Appointment";
    const phone = resolveReminderContactPhone(meta, (meta.inviteePhone as string) || null);
    const serviceId = row.serviceName ? serviceNameToId.get(row.serviceName) : null;
    const workflowConflict = describePlatformReminderWorkflowConflictFromContext(
      workflowCtx,
      serviceId,
      row.serviceName,
    );
    let block = blockReason(meta, phone, row.status, platform, appointmentRemindersActivatedAt);
    if (workflowConflict.blocked) {
      block = {
        blocked: true,
        detail: workflowConflict.detail || "Another automation sends reminders for this appointment.",
        hint: "Open Automations or adjust appointment type scope",
      };
    }

    const future = buildFutureReminderSchedule({
      startsAt: row.startsAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      timezone: row.timezone || platform.timezone,
      steps: smsSteps.map((s) => ({ key: s.id, step: { ...s.step, minutesBefore: s.minutesBefore } })),
      metadata: meta,
      weeklyHours,
      confirmationStepEnabled: platform.reminders.confirmation.enabled,
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
      }

      const operational: ArReminderOperationalRow = {
        id: `${row.id}-future-${step.stepKey}`,
        appointmentId: row.id,
        customerLabel,
        appointmentLabel,
        reminderLabel: step.label,
        channel: "SMS",
        scheduledFor: step.scheduledFor || null,
        occurredAt: null,
        status,
        statusLabel: label,
        detail,
        actionHint: hint,
      };
      if (!matchesFilter(operational, opts.status)) continue;
      rows.push(operational);
    }
  }

  const totalFutureRows = appointmentCount * Math.max(1, smsSteps.length);
  return { rows, total: totalFutureRows };
}

export async function loadRemindersLogPage(input: {
  workspaceId: string;
  q?: string;
  status?: string;
  horizon?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  rows: ArReminderOperationalRow[];
  total: number;
  summary: {
    scheduled: number;
    sentToday: number;
    sent30d: number;
    failed7d: number;
    blocked: number;
  };
}> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, input.pageSize ?? 25));
  const horizon = input.horizon || "all";
  const now = Date.now();

  let rows: ArReminderOperationalRow[] = [];
  let total = 0;

  if (horizon === "upcoming") {
    const future = await fetchFutureScheduledRows(input.workspaceId, {
      page,
      pageSize,
      search: input.q,
      status: input.status,
    });
    rows = future.rows;
    total = future.total;
  } else if (horizon === "past") {
    const past = await fetchPastSmsTimelineEvents(input.workspaceId, {
      offset: (page - 1) * pageSize,
      limit: pageSize,
      search: input.q,
    });
    rows = past.rows.filter((r) => matchesFilter(r, input.status));
    total = past.total;
  } else {
    const half = Math.ceil(pageSize / 2);
    const [past, future] = await Promise.all([
      fetchPastSmsTimelineEvents(input.workspaceId, {
        offset: (page - 1) * half,
        limit: half,
        search: input.q,
      }),
      fetchFutureScheduledRows(input.workspaceId, {
        page,
        pageSize: half,
        search: input.q,
        status: input.status,
      }),
    ]);
    rows = [...past.rows, ...future.rows]
      .filter((r) => matchesFilter(r, input.status))
      .sort((a, b) => {
        const ta = new Date(a.occurredAt || a.scheduledFor || 0).getTime();
        const tb = new Date(b.occurredAt || b.scheduledFor || 0).getTime();
        return tb - ta;
      });
    total = past.total + future.total;
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const summary = {
    scheduled: rows.filter((r) => r.status === "scheduled").length,
    sentToday: rows.filter((r) => {
      if (r.status !== "sent" && r.status !== "delivered") return false;
      if (!r.occurredAt) return false;
      return new Date(r.occurredAt) >= dayStart;
    }).length,
    sent30d: rows.filter((r) => {
      if (r.status !== "sent" && r.status !== "delivered") return false;
      const t = r.occurredAt ? new Date(r.occurredAt).getTime() : 0;
      return t > 0 && now - t <= SENT_WINDOW_MS;
    }).length,
    failed7d: rows.filter((r) => {
      if (r.status !== "failed") return false;
      const t = r.occurredAt ? new Date(r.occurredAt).getTime() : 0;
      return t > 0 && now - t <= FAILED_WINDOW_MS;
    }).length,
    blocked: rows.filter((r) => r.status === "blocked" || r.status === "past_due").length,
  };

  return { rows, total, summary };
}

/** Workspace-wide summary counts (not limited to current page). */
export async function loadRemindersLogGlobalSummary(workspaceId: string): Promise<{
  scheduled: number;
  sentToday: number;
  sent30d: number;
  failed7d: number;
  blocked: number;
}> {
  const now = Date.now();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const prisma = getPrisma();

  const pastEvents = await prisma.$queryRaw<
    Array<{ event_type: string; event_at: string | null }>
  >`
    SELECT ev.elem->>'type' AS event_type, ev.elem->>'at' AS event_at
    FROM voice_appointments va
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(va.metadata->'timeline', '[]'::jsonb)) AS ev(elem)
    WHERE va.workspace_id = ${workspaceId}
  `;

  let sentToday = 0;
  let sent30d = 0;
  let failed7d = 0;

  for (const ev of pastEvents) {
    if (!isSmsReminderTimelineEvent(ev.event_type)) continue;
    const outcome = mapSmsReminderTimelineOutcome(ev.event_type);
    const at = ev.event_at ? new Date(ev.event_at).getTime() : 0;
    if (!at) continue;
    if (outcome.status === "failed" && now - at <= FAILED_WINDOW_MS) failed7d += 1;
    if (outcome.status === "sent" || outcome.status === "delivered") {
      if (new Date(ev.event_at!) >= dayStart) sentToday += 1;
      if (now - at <= SENT_WINDOW_MS) sent30d += 1;
    }
  }

  const future = await fetchFutureScheduledRows(workspaceId, {
    page: 1,
    pageSize: 200,
    status: "all",
  });

  return {
    scheduled: future.rows.filter((r) => r.status === "scheduled").length,
    sentToday,
    sent30d,
    failed7d,
    blocked: future.rows.filter((r) => r.status === "blocked" || r.status === "past_due").length,
  };
}
