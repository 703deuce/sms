import "server-only";

import { getPrisma } from "@/lib/db";
import { notifyWorkspace } from "@/lib/notifications/in-app";
import { AR_ROUTES } from "@/lib/appointment-reminders/routes";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { commitArReschedule } from "./commit-reschedule";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { resolveAiReschedulerConfig, isAiBusinessApprovalMode } from "./types";
import { sendInternationalAppointmentSms } from "@/lib/appointments/reminder-engine";

async function sendArMeteredApprovalSms(input: {
  workspaceId: string;
  appointmentId: string;
  timelineType: string;
  to: string;
  body: string;
}): Promise<void> {
  const { analyzeSmsBody } = await import("@/lib/sms/segment-encoding");
  const { reserveArReminderSmsUnit, releaseArReminderSmsReservation } = await import(
    "@/lib/appointment-reminders/ar-sms-usage"
  );
  const segments = Math.max(1, analyzeSmsBody(input.body).segmentCount);
  const reservation = await reserveArReminderSmsUnit({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    timelineType: input.timelineType,
    segments,
  });
  if (!reservation.reserved) return;
  try {
    await sendInternationalAppointmentSms({
      workspaceId: input.workspaceId,
      to: input.to,
      body: input.body,
    });
  } catch {
    await releaseArReminderSmsReservation({
      workspaceId: input.workspaceId,
      appointmentId: input.appointmentId,
      timelineType: input.timelineType,
      segments,
    });
  }
}

export type ArRescheduleRequestMeta = {
  status:
    | "pending_business"
    | "pending_approval"
    | "processing"
    | "approved"
    | "rejected"
    | "failed"
    | "expired";
  failureReason?: string;
  requestedAt: string;
  channel: "sms" | "email";
  proposedStartsAt?: string;
  customerNote?: string;
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

  if (input.contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: input.contactId, workspaceId: input.workspaceId },
      select: { phone: true },
    });
    if (contact?.phone) {
      await sendArMeteredApprovalSms({
        workspaceId: input.workspaceId,
        appointmentId: input.appointmentId,
        timelineType: "ar_approval_ack_sent",
        to: contact.phone,
        body: `Thanks — we received your request to move your appointment to ${when}. The business will confirm shortly.`,
      });
    }
  }
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
  let req = meta.arRescheduleRequest;
  if (!req || !req.proposedStartsAt) {
    return { ok: false, message: "No pending reschedule request" };
  }
  const { expireArRescheduleRequestIfNeeded } = await import("./reschedule-request-lifecycle");
  req = expireArRescheduleRequestIfNeeded(req);
  if (req.status === "expired") {
    await prisma.voiceAppointment.update({
      where: { id: input.appointmentId },
      data: {
        status: "scheduled",
        metadata: { ...meta, arRescheduleRequest: req } as object,
      },
    });
    return { ok: false, message: "Requested time has passed. Reject or ask the customer for a new time." };
  }
  if (req.status === "processing") {
    return { ok: false, message: "Approval is already in progress" };
  }
  if (req.status !== "pending_approval" && req.status !== "pending_business") {
    return { ok: false, message: "No pending reschedule request" };
  }

  await prisma.voiceAppointment.update({
    where: { id: input.appointmentId },
    data: {
      metadata: {
        ...meta,
        arRescheduleRequest: { ...req, status: "processing" },
      } as object,
    },
  });

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
    await prisma.voiceAppointment.update({
      where: { id: input.appointmentId },
      data: {
        metadata: {
          ...meta,
          arRescheduleRequest: {
            ...req,
            status: "failed",
            failureReason: committed.message,
          },
        } as object,
      },
    });
    await notifyWorkspace(input.workspaceId, {
      type: "system",
      title: "Reschedule approval failed",
      body: committed.message,
      href: `${AR_ROUTES.appointments}?highlight=${input.appointmentId}`,
    });
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
    await sendArMeteredApprovalSms({
      workspaceId: input.workspaceId,
      appointmentId: input.appointmentId,
      timelineType: "ar_approval_approved_sent",
      to: phone,
      body: `You're rescheduled for ${when}. Your appointment has been updated.`,
    });
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
  if (!req || req.status === "processing") {
    return { ok: false, message: "No pending reschedule request" };
  }
  if (req.status !== "pending_approval" && req.status !== "pending_business") {
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
    await sendArMeteredApprovalSms({
      workspaceId: input.workspaceId,
      appointmentId: input.appointmentId,
      timelineType: "ar_approval_rejected_sent",
      to: phone,
      body: `We couldn't move your appointment. You're still scheduled for ${when}.`,
    });
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
