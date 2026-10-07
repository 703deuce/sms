import "server-only";

import { getPrisma } from "@/lib/db";
import { resetAppointmentReminders } from "@/lib/appointments/reminder-state";
import { appendTimeline } from "@/lib/appointments/settings";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { patchProviderEventTimes } from "./provider-mutations";
import { resolveAiReschedulerConfig, isAiAutomaticCalendarMutation } from "./types";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";

export async function commitArReschedule(input: {
  workspaceId: string;
  appointmentId: string;
  startsAt: string;
  initiatedBy: "customer" | "staff" | "system";
  operationId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  const ar = resolveAiReschedulerConfig(platform);
  if (!isAiAutomaticCalendarMutation(ar)) {
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

  const durationMs =
    ar.durationMode === "fixed" && ar.fixedDurationMinutes
      ? ar.fixedDurationMinutes * 60_000
      : row.endsAt && row.startsAt
        ? row.endsAt.getTime() - row.startsAt.getTime()
        : 30 * 60_000;
  const end = new Date(start.getTime() + durationMs);

  const providerResult = await patchProviderEventTimes({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    startsAt: start,
    endsAt: end,
    summary: row.serviceName || undefined,
  });
  if (!providerResult.ok) {
    await prisma.voiceAppointment.update({
      where: { id: row.id },
      data: {
        metadata: {
          ...meta,
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
    return { ok: false, message: providerResult.message };
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

  try {
    await prisma.voiceAppointment.update({
      where: { id: row.id },
      data: {
        startsAt: start,
        endsAt: end,
        status: "scheduled",
        metadata: withTimeline as object,
      },
    });
  } catch (err) {
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
