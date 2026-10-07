import "server-only";

import { getPrisma } from "@/lib/db";
import { resetAppointmentReminders } from "@/lib/appointments/reminder-state";
import { appendTimeline } from "@/lib/appointments/settings";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { providerRefFromAppointment } from "./provider-mutations";
import { getGoogleCalendarEvent, getValidAccessToken, resolveWriteCalendarId } from "@/lib/calendar/providers";
import type { CalendarConfig } from "@/lib/calendar/providers";
import { fetchMicrosoftEventById } from "@/lib/voice-v3/calendar/microsoft/microsoft-get-event";

type ReconcileMeta = {
  operationId: string;
  providerUpdatedAt: string;
  proposedStartsAt: string;
  proposedEndsAt: string;
  error?: string;
};

function timesMatch(a: Date, bIso: string, toleranceMs = 60_000): boolean {
  const b = new Date(bIso).getTime();
  return Math.abs(a.getTime() - b) <= toleranceMs;
}

async function providerReflectsProposedTime(input: {
  workspaceId: string;
  appointmentId: string;
  proposedStartsAt: string;
  proposedEndsAt: string;
}): Promise<boolean> {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
  });
  if (!row) return false;
  const ref = providerRefFromAppointment(row);
  if (!ref) return true;

  const conn = await prisma.voiceCalendarConnection.findFirst({
    where: { id: ref.connectionId, workspaceId: input.workspaceId },
  });
  if (!conn) return false;
  const config = (conn.config || {}) as CalendarConfig;

  if (ref.provider === "microsoft") {
    const snap = await fetchMicrosoftEventById({
      connectionId: ref.connectionId,
      calendarConfig: config,
      providerEventId: ref.providerEventId,
    });
    if (!snap.ok) return false;
    return (
      timesMatch(new Date(snap.event.startUtc), input.proposedStartsAt) &&
      timesMatch(new Date(snap.event.endUtc), input.proposedEndsAt)
    );
  }

  const token = await getValidAccessToken(conn.id, "google", config);
  if (!token) return false;
  const ev = await getGoogleCalendarEvent(
    token,
    resolveWriteCalendarId(config),
    ref.providerEventId,
  );
  if (!ev?.start) return false;
  return (
    timesMatch(ev.start, input.proposedStartsAt) &&
    timesMatch(ev.end || ev.start, input.proposedEndsAt)
  );
}

export async function reconcileArReschedulePending(input: {
  workspaceId: string;
  appointmentId: string;
}): Promise<{ ok: boolean; message: string }> {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
  });
  if (!row) return { ok: false, message: "Appointment not found" };

  const meta = (row.metadata || {}) as AppointmentMetadata & {
    arReconcilePending?: ReconcileMeta;
    arRescheduleOps?: Record<string, { status: string; at: string }>;
  };
  const pending = meta.arReconcilePending;
  if (!pending) return { ok: true, message: "Nothing to reconcile" };

  const providerOk = await providerReflectsProposedTime({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    proposedStartsAt: pending.proposedStartsAt,
    proposedEndsAt: pending.proposedEndsAt,
  });
  if (!providerOk) {
    return {
      ok: false,
      message: "Provider event does not match proposed reschedule; manual review required",
    };
  }

  const start = new Date(pending.proposedStartsAt);
  const end = new Date(pending.proposedEndsAt);
  const ops = meta.arRescheduleOps || {};
  const opStatus = ops[pending.operationId];
  if (opStatus?.status === "completed") {
    await prisma.voiceAppointment.update({
      where: { id: row.id },
      data: {
        metadata: {
          ...meta,
          arReconcilePending: undefined,
        } as object,
      },
    });
    return { ok: true, message: "Already reconciled" };
  }

  const { markArDurableCompleted } = await import("./durable-operation");
  const nextMeta = resetAppointmentReminders({
    ...markArDurableCompleted(meta),
    arReconcilePending: undefined,
    arRemindersHeld: false,
    arRescheduleOps: {
      ...ops,
      [pending.operationId]: { status: "completed", at: new Date().toISOString() },
    },
    lastChangeInitiatedBy: "system",
  });
  const withTimeline = appendTimeline(nextMeta, {
    type: "rescheduled",
    label: "Rescheduled (reconciled after calendar update)",
    detail: start.toISOString(),
  });

  await prisma.voiceAppointment.update({
    where: { id: row.id },
    data: {
      startsAt: start,
      endsAt: end,
      status: "scheduled",
      metadata: withTimeline as object,
    },
  });

  return { ok: true, message: "Reconciled local appointment with provider" };
}

export async function scanArRescheduleReconcilePending(): Promise<{ scanned: number; enqueued: number }> {
  const prisma = getPrisma();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await prisma.voiceAppointment.findMany({
    where: { updatedAt: { gte: since } },
    select: { id: true, workspaceId: true, metadata: true },
    take: 300,
    orderBy: { updatedAt: "desc" },
  });
  let enqueued = 0;
  for (const row of rows) {
    const meta = (row.metadata || {}) as { arReconcilePending?: { operationId?: string } };
    if (!meta.arReconcilePending?.operationId) continue;
    await enqueueArRescheduleReconcile({
      workspaceId: row.workspaceId,
      appointmentId: row.id,
      operationId: meta.arReconcilePending.operationId,
    });
    enqueued++;
  }
  return { scanned: rows.length, enqueued };
}

export async function enqueueArRescheduleReconcile(input: {
  workspaceId: string;
  appointmentId: string;
  operationId: string;
}): Promise<void> {
  const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
  await enqueueJob({
    jobType: "ar_reschedule_reconcile",
    workspaceId: input.workspaceId,
    idempotencyKey: `ar_reschedule_reconcile:${input.appointmentId}:${input.operationId}`,
    payload: {
      workspaceId: input.workspaceId,
      appointmentId: input.appointmentId,
      operationId: input.operationId,
    },
    runAfter: new Date(Date.now() + 5_000),
    maxAttempts: 8,
  });
}
