import "server-only";

import { getPrisma } from "@/lib/db";
import { resetAppointmentReminders } from "@/lib/appointments/reminder-state";
import { appendTimeline } from "@/lib/appointments/settings";
import { recordArSmsCustomerOutcome } from "../record-ar-sms-outcome";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { patchProviderEventTimes } from "./provider-mutations";
import { resolveAiReschedulerConfig, isAiAutomaticCalendarMutation } from "./types";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { resolveArRescheduleSmsPolicy } from "./ar-sms-action-policy";
import {
  consumePolicyAck,
  gateArSmsCalendarWriteByPolicy,
  getArSmsPolicyAck,
  mergePolicyAckIntoMetadata,
} from "./ar-sms-policy-ack";

export async function commitArReschedule(input: {
  workspaceId: string;
  appointmentId: string;
  startsAt: string;
  initiatedBy: "customer" | "staff" | "system";
  operationId: string;
  /** Staff approval path revalidates at approve time. */
  skipModeCheck?: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  const ar = resolveAiReschedulerConfig(platform);
  if (!input.skipModeCheck && !isAiAutomaticCalendarMutation(ar)) {
    return { ok: false, message: "Automatic calendar reschedule is not enabled" };
  }

  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
  });
  if (!row) return { ok: false, message: "Appointment not found" };

  const meta = (row.metadata || {}) as AppointmentMetadata & {
    arRescheduleOps?: Record<string, { status: string; at: string }>;
  };
  const ops = meta.arRescheduleOps || {};
  if (ops[input.operationId]?.status === "completed") {
    return { ok: true };
  }

  const start = new Date(input.startsAt);
  if (Number.isNaN(start.getTime())) return { ok: false, message: "Invalid start time" };

  let policyGateAck = null as ReturnType<typeof getArSmsPolicyAck>;
  if (input.initiatedBy === "customer") {
    const policyGate = gateArSmsCalendarWriteByPolicy({
      meta,
      action: "reschedule",
      startsAt: row.startsAt,
      policy: resolveArRescheduleSmsPolicy(ar),
    });
    if (!policyGate.allowed) {
      return { ok: false, message: policyGate.customerMessage };
    }
    policyGateAck = policyGate.ack;
  }

  const { assertSafeSingleOccurrenceMutation } = await import("./recurring-guard");
  const recurring = await assertSafeSingleOccurrenceMutation({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
  });
  if (!recurring.ok) return { ok: false, message: recurring.message };

  const { revalidateArSlotBeforeCommit } = await import("./revalidate-slot");
  const slotOk = await revalidateArSlotBeforeCommit({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    startsAt: input.startsAt,
  });
  if (!slotOk.ok) return { ok: false, message: slotOk.message };

  const durationMs =
    ar.durationMode === "fixed" && ar.fixedDurationMinutes
      ? ar.fixedDurationMinutes * 60_000
      : row.endsAt && row.startsAt
        ? row.endsAt.getTime() - row.startsAt.getTime()
        : 30 * 60_000;
  const end = new Date(start.getTime() + durationMs);

  const { beginArDurableReschedule, markArDurableProviderSucceeded, markArDurableCompleted, markArDurableFailed } =
    await import("./durable-operation");
  const durableMeta = beginArDurableReschedule({
    meta,
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    operationId: input.operationId,
    row,
    proposedStartsAt: start.toISOString(),
    proposedEndsAt: end.toISOString(),
  });
  await prisma.voiceAppointment.update({
    where: { id: row.id },
    data: { metadata: durableMeta as object },
  });

  const providerResult = await patchProviderEventTimes({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    startsAt: start,
    endsAt: end,
    summary: row.serviceName || undefined,
  });
  if (!providerResult.ok) {
    const failedMeta = markArDurableFailed(durableMeta, providerResult.message);
    await prisma.voiceAppointment.update({
      where: { id: row.id },
      data: {
        metadata: {
          ...failedMeta,
          arRescheduleOps: {
            ...ops,
            [input.operationId]: {
              status: "provider_failed",
              at: new Date().toISOString(),
              message: providerResult.message,
            },
          },
        } as object,
      },
    });
    const { notifyWorkspace } = await import("@/lib/notifications/in-app");
    const { AR_ROUTES } = await import("@/lib/appointment-reminders/routes");
    await notifyWorkspace(input.workspaceId, {
      type: "system",
      title: "Reschedule calendar update failed",
      body: providerResult.message,
      href: `${AR_ROUTES.appointments}?highlight=${input.appointmentId}`,
    }).catch(() => undefined);
    return { ok: false, message: providerResult.message };
  }

  const afterProvider = markArDurableProviderSucceeded(durableMeta);
  await prisma.voiceAppointment.update({
    where: { id: row.id },
    data: { metadata: afterProvider as object },
  });

  const nextMeta = resetAppointmentReminders({
    ...markArDurableCompleted(afterProvider),
    arRescheduleOps: {
      ...ops,
      [input.operationId]: { status: "completed", at: new Date().toISOString() },
    },
    lastChangeInitiatedBy: input.initiatedBy,
  });
  const withTimeline = appendTimeline(nextMeta, {
    type: "rescheduled",
    label: "Rescheduled via Appointment Reminders SMS",
    detail: start.toISOString(),
  });

  let finalMeta = withTimeline as AppointmentMetadata;
  if (policyGateAck) {
    const ack = getArSmsPolicyAck(finalMeta) ?? policyGateAck;
    finalMeta = mergePolicyAckIntoMetadata(finalMeta, consumePolicyAck(ack, "reschedule"));
  }

  try {
    await prisma.voiceAppointment.update({
      where: { id: row.id },
      data: {
        startsAt: start,
        endsAt: end,
        status: "scheduled",
        metadata: finalMeta as object,
      },
    });
  } catch (err) {
    await prisma.voiceAppointment.update({
      where: { id: row.id },
      data: {
        metadata: {
          ...withTimeline,
          arReconcilePending: {
            operationId: input.operationId,
            providerUpdatedAt: new Date().toISOString(),
            proposedStartsAt: start.toISOString(),
            proposedEndsAt: end.toISOString(),
            error: err instanceof Error ? err.message : "local_update_failed",
          },
        } as object,
      },
    });
    const { enqueueArRescheduleReconcile } = await import("./reconcile-pending");
    await enqueueArRescheduleReconcile({
      workspaceId: input.workspaceId,
      appointmentId: input.appointmentId,
      operationId: input.operationId,
    }).catch(() => undefined);
    return {
      ok: false,
      message:
        err instanceof Error
          ? `Calendar updated but local record failed: ${err.message}`
          : "Calendar updated but local record failed",
    };
  }

  return { ok: true };
}

/** Local DB + reminders after provider event already verified at new times (V3 commit path). */
export async function syncLocalAppointmentAfterProviderReschedule(input: {
  workspaceId: string;
  appointmentId: string;
  startsAt: string;
  endsAt: string;
  operationId: string;
  initiatedBy: "customer" | "staff" | "system";
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
  });
  if (!row) return { ok: false, message: "Appointment not found" };

  const start = new Date(input.startsAt);
  const end = new Date(input.endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, message: "Invalid times" };
  }

  const meta = (row.metadata || {}) as AppointmentMetadata & {
    arRescheduleOps?: Record<string, { status: string; at: string }>;
  };
  const ops = meta.arRescheduleOps || {};
  if (ops[input.operationId]?.status === "completed") {
    return { ok: true };
  }

  const nextMeta = resetAppointmentReminders({
    ...meta,
    arRescheduleOps: {
      ...ops,
      [input.operationId]: { status: "completed", at: new Date().toISOString() },
    },
    lastChangeInitiatedBy: input.initiatedBy,
  });
  const withTimeline = appendTimeline(nextMeta, {
    type: "rescheduled",
    label: "Rescheduled via Appointment Reminders SMS",
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
  await recordArSmsCustomerOutcome({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    outcome: "rescheduled",
    newStartsAtIso: start.toISOString(),
    evidence: {
      calendarResult: "verified",
      action: "reschedule",
      operationId: input.operationId,
    },
  });
  return { ok: true };
}
