import "server-only";

import { getPrisma } from "@/lib/db";
import { notifyWorkspace } from "@/lib/notifications/in-app";
import { AR_ROUTES } from "@/lib/appointment-reminders/routes";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { commitArReschedule } from "./commit-reschedule";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { resolveAiReschedulerConfig, isAiBusinessApprovalMode } from "./types";
import { sendInternationalAppointmentSms } from "@/lib/appointments/reminder-engine";

export type ArRescheduleRequestMeta = {
  status: "pending_business" | "pending_approval" | "approved" | "rejected" | "failed";
  requestedAt: string;
  channel: "sms";
  proposedStartsAt?: string;
  proposedEndsAt?: string;
  operationId?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
};

export async function queueArRescheduleBusinessApproval(input: {
  workspaceId: string;
  appointmentId: string;
  contactId?: string;
  proposedStartsAt: string;
  proposedEndsAt: string;
  operationId: string;
}): Promise<void> {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
    select: { metadata: true, serviceName: true, startsAt: true, contactId: true },
  });
  if (!row) return;

  const meta = (row.metadata || {}) as AppointmentMetadata & {
    arRescheduleRequest?: ArRescheduleRequestMeta;
  };
  await prisma.voiceAppointment.update({
    where: { id: input.appointmentId },
    data: {
      status: "reschedule_requested",
      metadata: {
        ...meta,
        arRescheduleRequest: {
          status: "pending_approval",
          requestedAt: new Date().toISOString(),
          channel: "sms",
          proposedStartsAt: input.proposedStartsAt,
          proposedEndsAt: input.proposedEndsAt,
          operationId: input.operationId,
        },
      } as object,
    },
  });

  const when = new Date(input.proposedStartsAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  await notifyWorkspace(input.workspaceId, {
    type: "system",
    title: "Reschedule approval needed",
    body: `Customer requested ${row.serviceName || "appointment"} move to ${when}.`,
    href: `${AR_ROUTES.appointments}?highlight=${input.appointmentId}`,
  });
}

export async function approveArRescheduleRequest(input: {
  workspaceId: string;
  appointmentId: string;
  staffUserId?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  const ar = resolveAiReschedulerConfig(platform);
  if (!isAiBusinessApprovalMode(ar)) {
    return { ok: false, message: "Business approval mode is not enabled" };
  }

  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
    include: { contact: { select: { phone: true } } },
  });
  if (!row) return { ok: false, message: "Appointment not found" };

  const meta = (row.metadata || {}) as AppointmentMetadata & {
    arRescheduleRequest?: ArRescheduleRequestMeta;
  };
  const req = meta.arRescheduleRequest;
  if (!req || req.status !== "pending_approval" || !req.proposedStartsAt) {
    return { ok: false, message: "No pending reschedule request" };
  }

  const operationId = req.operationId || `staff-approve:${input.appointmentId}:${Date.now()}`;
  const committed = await commitArReschedule({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    startsAt: req.proposedStartsAt,
    initiatedBy: "staff",
    operationId,
    skipModeCheck: true,
  });
  if (!committed.ok) {
    return committed;
  }

  await prisma.voiceAppointment.update({
    where: { id: input.appointmentId },
    data: {
      metadata: {
        ...meta,
        arRescheduleRequest: { ...req, status: "approved" },
      } as object,
    },
  });

  const phone = row.contact?.phone;
  if (phone) {
    const when = new Date(req.proposedStartsAt).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: row.timezone || undefined,
    });
    await sendInternationalAppointmentSms({
      workspaceId: input.workspaceId,
      to: phone,
      body: `You're rescheduled for ${when}. Your appointment has been updated.`,
    }).catch(() => undefined);
  }

  return { ok: true };
}

export async function rejectArRescheduleRequest(input: {
  workspaceId: string;
  appointmentId: string;
  staffUserId?: string;
  reason?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
    include: { contact: { select: { phone: true } } },
  });
  if (!row) return { ok: false, message: "Appointment not found" };

  const meta = (row.metadata || {}) as AppointmentMetadata & {
    arRescheduleRequest?: ArRescheduleRequestMeta;
  };
  const req = meta.arRescheduleRequest;
  if (
    !req ||
    (req.status !== "pending_approval" && req.status !== "pending_business")
  ) {
    return { ok: false, message: "No pending reschedule request" };
  }

  const when = row.startsAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: row.timezone || undefined,
  });

  await prisma.voiceAppointment.update({
    where: { id: input.appointmentId },
    data: {
      status: row.status === "reschedule_requested" ? "scheduled" : row.status,
      metadata: {
        ...meta,
        arRescheduleRequest: {
          ...req,
          status: "rejected",
          rejectedAt: new Date().toISOString(),
          rejectedBy: input.staffUserId,
          rejectionReason: input.reason,
        },
      } as object,
    },
  });

  const phone = row.contact?.phone;
  if (phone) {
    await sendInternationalAppointmentSms({
      workspaceId: input.workspaceId,
      to: phone,
      body: `We couldn't move your appointment. You're still scheduled for ${when}.`,
    }).catch(() => undefined);
  }

  return { ok: true };
}

export async function notifyBusinessRescheduleInterest(input: {
  workspaceId: string;
  appointmentId: string;
  message?: string;
}): Promise<void> {
  await notifyWorkspace(input.workspaceId, {
    type: "system",
    title: "Customer requested to reschedule",
    body: input.message || "A customer replied to an appointment reminder asking to reschedule.",
    href: `${AR_ROUTES.appointments}?highlight=${input.appointmentId}`,
  });
}
