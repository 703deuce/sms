import "server-only";

import { getPrisma } from "@/lib/db";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { appendTimeline } from "@/lib/appointments/settings";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { providerRefFromAppointment } from "@/lib/appointment-reminders/ai-rescheduler/provider-mutations";
import { AR_QUEUE_NAME } from "@/lib/appointment-reminders/messaging/constants";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { JOB_PRIORITY_TRANSACTIONAL } from "@/lib/jobs/job-priority";
import { resolveArCalendarWriteBackSettings } from "./settings";
import {
  AR_CALENDAR_WRITE_BACK_JOB_TYPE,
  type ArCalendarWriteBackJobPayload,
  type ArCalendarWriteBackKind,
  type ArCalendarWriteBackRecord,
  type AppointmentMetadataWithWriteBack,
} from "./types";

function nextRevision(meta: AppointmentMetadataWithWriteBack): number {
  return (meta.arCalendarWriteBack?.revision ?? 0) + 1;
}

export async function enqueueArCalendarWriteBack(input: {
  workspaceId: string;
  appointmentId: string;
  kind: ArCalendarWriteBackKind;
  atIso?: string;
  previousStartsAtIso?: string;
  previousEndsAtIso?: string;
  newStartsAtIso?: string;
  newEndsAtIso?: string;
}): Promise<{ enqueued: boolean; reason?: string }> {
  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  const settings = resolveArCalendarWriteBackSettings(platform);
  if (!settings.enabled) {
    return { enqueued: false, reason: "disabled" };
  }

  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
  });
  if (!row) return { enqueued: false, reason: "appointment_not_found" };

  const ref = providerRefFromAppointment(row);
  if (!ref) return { enqueued: false, reason: "no_provider_ref" };
  if (ref.provider !== "microsoft") {
    return { enqueued: false, reason: "provider_not_supported" };
  }

  const meta = (row.metadata || {}) as AppointmentMetadataWithWriteBack;
  const revision = nextRevision(meta);
  const atIso = input.atIso || new Date().toISOString();
  const timezone =
    ref.timezone ||
    platform.timezone ||
    row.timezone ||
    "America/New_York";

  const idempotencyKey = `ar-cwb:${input.appointmentId}:${input.kind}:r${revision}`;

  const payload: ArCalendarWriteBackJobPayload = {
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    kind: input.kind,
    revision,
    atIso,
    timezone,
    previousStartsAtIso: input.previousStartsAtIso,
    previousEndsAtIso: input.previousEndsAtIso,
    newStartsAtIso: input.newStartsAtIso,
    newEndsAtIso: input.newEndsAtIso,
  };

  const pendingRecord: ArCalendarWriteBackRecord = {
    revision,
    lastKind: input.kind,
    lastStatus: "pending",
    lastAttemptAt: atIso,
    provider: "microsoft",
    lastIdempotencyKey: idempotencyKey,
  };

  const withPending: AppointmentMetadata = {
    ...meta,
    arCalendarWriteBack: {
      ...(meta.arCalendarWriteBack || {}),
      ...pendingRecord,
    },
  };

  await prisma.voiceAppointment.update({
    where: { id: row.id },
    data: { metadata: withPending as object },
  });

  await enqueueJob({
    jobType: AR_CALENDAR_WRITE_BACK_JOB_TYPE,
    queueName: AR_QUEUE_NAME,
    workspaceId: input.workspaceId,
    idempotencyKey,
    priority: JOB_PRIORITY_TRANSACTIONAL,
    payload,
  });

  const { scheduleJobDrain } = await import("@/lib/jobs/inprocess-worker");
  scheduleJobDrain(25);

  return { enqueued: true };
}

export function writeBackActivityLabel(kind: ArCalendarWriteBackKind): string {
  switch (kind) {
    case "confirmed":
      return "Confirmation written to calendar";
    case "cancellation_requested":
      return "Cancellation request written to calendar";
    case "canceled":
      return "Cancellation written to calendar";
    case "reschedule_requested":
      return "Reschedule request written to calendar";
    case "rescheduled":
      return "Appointment rescheduled in calendar";
    default:
      return "Calendar write-back";
  }
}

export async function markWriteBackTimeline(
  workspaceId: string,
  appointmentId: string,
  kind: ArCalendarWriteBackKind,
  detail: string,
  failed?: boolean,
): Promise<void> {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
    select: { metadata: true },
  });
  if (!row) return;
  const meta = (row.metadata || {}) as AppointmentMetadata;
  const next = appendTimeline(meta, {
    type: failed ? "calendar_writeback_failed" : "calendar_writeback",
    label: failed ? "Calendar write-back failed" : writeBackActivityLabel(kind),
    detail,
    at: new Date().toISOString(),
  });
  await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: { metadata: next as object },
  });
}
