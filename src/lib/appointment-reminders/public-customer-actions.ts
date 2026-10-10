import "server-only";

import { appendTimeline } from "@/lib/appointments/settings";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { getPrisma } from "@/lib/db";
import {
  notifyBusinessRescheduleInterest,
  type ArRescheduleRequestMeta,
} from "@/lib/appointment-reminders/ai-rescheduler/business-approval";
import {
  isArRemindersOnlyMode,
  resolveAiReschedulerConfig,
} from "@/lib/appointment-reminders/ai-rescheduler/types";
import { notifyWorkspace } from "@/lib/notifications/in-app";
import { AR_ROUTES } from "@/lib/appointment-reminders/routes";
import { arSmsOutcomeTimelineType } from "@/lib/appointment-reminders/ar-sms-customer-outcome";
import { recordArSmsCustomerOutcome } from "@/lib/appointment-reminders/record-ar-sms-outcome";

export type ArCancelPendingMeta = {
  requestedAt: string;
  channel: "sms" | "email";
  note?: string;
};

/** Email action links use staff-notified requests (not instant calendar cancel/reschedule). */
export async function publicEmailActionsUseStaffRequestWorkflow(
  workspaceId: string,
): Promise<boolean> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const ar = resolveAiReschedulerConfig(platform);
  return !isArRemindersOnlyMode(ar);
}

export async function requestRescheduleViaPublicEmail(input: {
  workspaceId: string;
  appointmentId: string;
  note?: string;
  preferredStartsAt?: string;
}): Promise<{ ok: true; status: string } | { ok: false; message: string }> {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
    select: { metadata: true, status: true, serviceName: true, startsAt: true, timezone: true },
  });
  if (!row) return { ok: false, message: "Appointment not found" };

  const meta = (row.metadata || {}) as AppointmentMetadata & {
    arRescheduleRequest?: ArRescheduleRequestMeta;
  };
  const existing = meta.arRescheduleRequest;
  if (
    existing &&
    (existing.status === "pending_business" ||
      existing.status === "pending_approval" ||
      existing.status === "processing")
  ) {
    return { ok: true, status: row.status || "scheduled" };
  }

  const requestedAt = new Date().toISOString();
  const req: ArRescheduleRequestMeta = {
    status: "pending_business",
    requestedAt,
    channel: "email",
    proposedStartsAt: input.preferredStartsAt,
    customerNote: input.note?.trim() || undefined,
  };

  let nextMeta = {
    ...meta,
    arRescheduleRequest: req,
  } as AppointmentMetadata;
  nextMeta = appendTimeline(nextMeta, {
    type: arSmsOutcomeTimelineType("reschedule_requested"),
    label: "Customer requested reschedule (email)",
    detail: input.note?.trim() || undefined,
  }) as AppointmentMetadata;

  await prisma.voiceAppointment.update({
    where: { id: input.appointmentId },
    data: {
      status: "reschedule_requested",
      metadata: nextMeta as object,
    },
  });

  await recordArSmsCustomerOutcome({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    outcome: "reschedule_requested",
    note: input.note,
    label: "Customer requested reschedule (email)",
  }).catch(() => undefined);

  const whenLabel = row.startsAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: row.timezone || undefined,
  });
  await notifyBusinessRescheduleInterest({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    message: input.note
      ? `Customer requested to reschedule (${whenLabel}). Note: ${input.note}`
      : `Customer requested to reschedule their appointment on ${whenLabel} via email.`,
  });

  return { ok: true, status: "reschedule_requested" };
}

export async function requestCancellationViaPublicEmail(input: {
  workspaceId: string;
  appointmentId: string;
  note?: string;
}): Promise<{ ok: true; status: string } | { ok: false; message: string }> {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
    select: { metadata: true, status: true, serviceName: true, startsAt: true, timezone: true },
  });
  if (!row) return { ok: false, message: "Appointment not found" };

  const statusLower = String(row.status || "").toLowerCase();
  if (statusLower === "canceled" || statusLower === "cancelled") {
    return { ok: true, status: row.status };
  }

  const meta = (row.metadata || {}) as AppointmentMetadata & {
    arCancelPending?: ArCancelPendingMeta;
  };
  if (meta.arCancelPending?.channel === "email") {
    return { ok: true, status: row.status || "scheduled" };
  }

  const requestedAt = new Date().toISOString();
  const nextMeta = appendTimeline(
    {
      ...meta,
      arCancelPending: {
        requestedAt,
        channel: "email",
        note: input.note?.trim() || undefined,
      },
    },
    {
      type: arSmsOutcomeTimelineType("cancel_pending"),
      label: "Customer requested cancellation (email)",
      detail: input.note?.trim() || undefined,
    },
  ) as AppointmentMetadata;

  await prisma.voiceAppointment.update({
    where: { id: input.appointmentId },
    data: { metadata: nextMeta as object },
  });

  await recordArSmsCustomerOutcome({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    outcome: "cancel_pending",
    note: input.note,
    label: "Customer requested cancellation (email)",
  }).catch(() => undefined);

  const whenLabel = row.startsAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: row.timezone || undefined,
  });
  await notifyWorkspace(input.workspaceId, {
    type: "system",
    title: "Customer requested cancellation",
    body: input.note
      ? `Cancellation requested for ${row.serviceName || "appointment"} on ${whenLabel}. Note: ${input.note}`
      : `A customer requested cancellation for ${row.serviceName || "an appointment"} on ${whenLabel} via email.`,
    href: `${AR_ROUTES.appointments}?highlight=${input.appointmentId}`,
  });

  return { ok: true, status: row.status || "scheduled" };
}
