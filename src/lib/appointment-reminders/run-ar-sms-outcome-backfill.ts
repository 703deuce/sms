import "server-only";

import { getPrisma } from "@/lib/db";
import { appendTimeline } from "@/lib/appointments/settings";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import {
  inferArSmsOutcomesForBackfill,
  hasArSmsOutcomeInTimeline,
  type ArSmsSessionBackfillRow,
} from "./ar-sms-outcome-backfill";
import { arSmsOutcomeTimelineType } from "./ar-sms-customer-outcome";
import { buildArSmsOutcomeDetail } from "./ar-sms-outcome-detail";
import type { ArSmsRecordableOutcome } from "./record-ar-sms-outcome";
import { voiceAppointmentModificationRecencyOrder } from "@/lib/appointments/voice-appointment-query";

const OUTCOME_LABELS: Record<ArSmsRecordableOutcome, string> = {
  confirmed: "Customer confirmed attendance",
  cancel_pending: "Customer requested cancellation",
  cancelled: "Customer cancelled appointment",
  reschedule_started: "Customer started rescheduling",
  reschedule_requested: "Customer requested reschedule",
  rescheduled: "Customer rescheduled appointment",
};

export type ArSmsOutcomeBackfillResult = {
  scanned: number;
  appointmentsWithInferences: number;
  outcomesAppended: number;
  skippedAlreadyPresent: number;
};

async function loadInboundSnippetsForSessions(
  sessions: ArSmsSessionBackfillRow[],
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const prisma = getPrisma();
  for (const session of sessions) {
    if (!session.conversationId) continue;
    const msg = await prisma.conversationMessage.findFirst({
      where: {
        conversationId: session.conversationId,
        direction: "inbound",
      },
      orderBy: { createdAt: "desc" },
      select: { body: true },
    });
    if (msg?.body?.trim()) map[session.id] = msg.body.trim();
  }
  return map;
}

async function collectAppointmentIds(input: {
  workspaceId?: string;
  appointmentId?: string;
  limit: number;
}): Promise<Array<{ id: string; workspaceId: string }>> {
  const prisma = getPrisma();
  if (input.appointmentId && input.workspaceId) {
    return [{ id: input.appointmentId, workspaceId: input.workspaceId }];
  }
  if (input.appointmentId) {
    const row = await prisma.voiceAppointment.findFirst({
      where: { id: input.appointmentId },
      select: { id: true, workspaceId: true },
    });
    return row ? [row] : [];
  }

  const fromMeta = await prisma.voiceAppointment.findMany({
    where: {
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
      OR: [
        { metadata: { path: ["arCustomerConfirmedAt"], not: null } },
        { metadata: { path: ["arCancelPending"], not: null } },
        { metadata: { path: ["arRescheduleRequest"], not: null } },
        { status: { in: ["canceled", "cancelled", "confirmed", "reschedule_requested"] } },
      ],
    },
    take: input.limit,
    orderBy: voiceAppointmentModificationRecencyOrder,
    select: { id: true, workspaceId: true },
  });

  const fromSessions = await prisma.arSmsReplySession.findMany({
    where: {
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
      lifecycleState: {
        in: ["COMPLETED", "RESCHEDULING", "AWAITING_CANCEL_CONFIRM", "AWAITING_STAFF_APPROVAL"],
      },
    },
    take: input.limit,
    orderBy: { lastUsedAt: "desc" },
    distinct: ["appointmentId"],
    select: { appointmentId: true, workspaceId: true },
  });

  const seen = new Set<string>();
  const merged: Array<{ id: string; workspaceId: string }> = [];
  for (const row of [...fromMeta, ...fromSessions.map((s) => ({ id: s.appointmentId, workspaceId: s.workspaceId }))]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
    if (merged.length >= input.limit) break;
  }
  return merged;
}

export async function runArSmsCustomerOutcomeBackfill(input: {
  workspaceId?: string;
  appointmentId?: string;
  limit?: number;
  dryRun?: boolean;
}): Promise<ArSmsOutcomeBackfillResult> {
  const prisma = getPrisma();
  const limit = Math.min(5000, Math.max(1, input.limit ?? 500));
  const targets = await collectAppointmentIds({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    limit,
  });

  let outcomesAppended = 0;
  let appointmentsWithInferences = 0;
  let skippedAlreadyPresent = 0;

  for (const target of targets) {
    const appt = await prisma.voiceAppointment.findFirst({
      where: { id: target.id, workspaceId: target.workspaceId },
      select: { id: true, workspaceId: true, status: true, startsAt: true, metadata: true },
    });
    if (!appt) continue;

    const sessions = await prisma.arSmsReplySession.findMany({
      where: { workspaceId: appt.workspaceId, appointmentId: appt.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        timelineType: true,
        lifecycleState: true,
        conversationId: true,
        createdAt: true,
        completedAt: true,
        lastUsedAt: true,
      },
    });

    const sessionRows: ArSmsSessionBackfillRow[] = sessions.map((s) => ({
      id: s.id,
      timelineType: s.timelineType,
      lifecycleState: s.lifecycleState,
      conversationId: s.conversationId,
      createdAt: s.createdAt,
      completedAt: s.completedAt,
      lastUsedAt: s.lastUsedAt,
    }));

    const snippets = await loadInboundSnippetsForSessions(sessionRows);
    let nextMeta = (appt.metadata || {}) as AppointmentMetadata;
    const inferred = inferArSmsOutcomesForBackfill({
      metadata: nextMeta,
      status: appt.status,
      startsAt: appt.startsAt,
      sessions: sessionRows,
      inboundSnippetBySessionId: snippets,
    });

    if (!inferred.length) continue;
    appointmentsWithInferences += 1;

    let changed = false;
    for (const row of inferred) {
      const timeline = nextMeta.timeline || [];
      if (hasArSmsOutcomeInTimeline(timeline, row.outcome)) {
        skippedAlreadyPresent += 1;
        continue;
      }
      outcomesAppended += 1;
      changed = true;
      if (input.dryRun) continue;

      nextMeta = appendTimeline(nextMeta, {
        type: arSmsOutcomeTimelineType(row.outcome),
        label: OUTCOME_LABELS[row.outcome],
        detail: buildArSmsOutcomeDetail({
          reminderTimelineType: row.reminderTimelineType,
          note: row.note,
          newStartsAtIso: row.newStartsAtIso,
        }),
        at: row.at,
      }) as AppointmentMetadata;
    }

    if (!input.dryRun && changed) {
      await prisma.voiceAppointment.update({
        where: { id: appt.id },
        data: { metadata: nextMeta as object },
      });
    }
  }

  return {
    scanned: targets.length,
    appointmentsWithInferences,
    outcomesAppended,
    skippedAlreadyPresent,
  };
}
