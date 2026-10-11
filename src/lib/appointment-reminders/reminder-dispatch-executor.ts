import "server-only";

import { getPrisma } from "@/lib/db";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import {
  currentReminderGeneration,
  wasReminderSent,
} from "@/lib/appointments/reminder-state";
import { trySendStepForDispatch } from "@/lib/appointments/reminder-delivery";

const CLAIM_LEASE_MS = 120_000;

export async function executeArReminderDispatchJob(payload: { dispatchId?: string }) {
  const dispatchId = String(payload.dispatchId || "");
  if (!dispatchId) return { ok: false, reason: "missing_dispatch_id" };

  const prisma = getPrisma();
  const now = new Date();
  const claimExpires = new Date(now.getTime() + CLAIM_LEASE_MS);

  const claimed = await prisma.arReminderDispatch.updateMany({
    where: {
      id: dispatchId,
      status: { in: ["pending", "failed"] },
      OR: [{ claimExpiresAt: null }, { claimExpiresAt: { lt: now } }],
    },
    data: {
      status: "claimed",
      claimedAt: now,
      claimExpiresAt: claimExpires,
    },
  });
  if (claimed.count !== 1) {
    const row = await prisma.arReminderDispatch.findUnique({ where: { id: dispatchId } });
    if (row?.status === "unknown") return { ok: false, reason: "unknown_outcome_no_resubmit" };
    return { ok: false, reason: "not_claimed", status: row?.status };
  }

  const dispatch = await prisma.arReminderDispatch.findUniqueOrThrow({ where: { id: dispatchId } });
  const appointment = await prisma.voiceAppointment.findFirst({
    where: { id: dispatch.appointmentId, workspaceId: dispatch.workspaceId },
  });
  if (!appointment) {
    await prisma.arReminderDispatch.update({
      where: { id: dispatchId },
      data: { status: "suppressed", lastError: "appointment_not_found" },
    });
    return { ok: false, reason: "appointment_not_found" };
  }

  const meta = (appointment.metadata || {}) as AppointmentMetadata;
  if (meta.remindersSuppressed || meta.reminderOverride?.suppressed) {
    await prisma.arReminderDispatch.update({
      where: { id: dispatchId },
      data: { status: "suppressed", lastError: "reminders_suppressed" },
    });
    return { ok: false, reason: "suppressed" };
  }

  const generation = currentReminderGeneration(meta);
  if (generation !== dispatch.reminderGeneration) {
    await prisma.arReminderDispatch.update({
      where: { id: dispatchId },
      data: { status: "suppressed", lastError: "stale_generation" },
    });
    return { ok: false, reason: "stale_generation" };
  }

  if (wasReminderSent(meta, dispatch.timelineType)) {
    await prisma.arReminderDispatch.update({
      where: { id: dispatchId },
      data: { status: "delivered", lastError: null },
    });
    return { ok: true, reason: "already_sent" };
  }

  await prisma.arReminderDispatch.update({
    where: { id: dispatchId },
    data: { status: "submitting", submittingAt: new Date() },
  });

  if (
    process.env.AR_REMINDER_DISPATCH_TEST_MOCK === "1" &&
    process.env.AR_REMINDER_DISPATCH_TEST_WORKSPACE &&
    dispatch.workspaceId === process.env.AR_REMINDER_DISPATCH_TEST_WORKSPACE
  ) {
    const mockId = `mock-telnyx-${dispatchId}`;
    await prisma.arReminderDispatch.update({
      where: { id: dispatchId },
      data: {
        status: "accepted",
        providerMessageId: mockId,
        telnyxMessageId: mockId,
        lastError: null,
      },
    });
    return { ok: true, sent: true, mock: true };
  }

  try {
    const result = await trySendStepForDispatch({
      dispatchId,
      workspaceId: dispatch.workspaceId,
      appointmentId: dispatch.appointmentId,
      timelineType: dispatch.timelineType,
      stepKey: String((dispatch.metadata as { stepKey?: string })?.stepKey || "reminder"),
    });

    if (result.outcome === "sent") {
      await prisma.arReminderDispatch.update({
        where: { id: dispatchId },
        data: {
          status: "accepted",
          providerMessageId: result.providerMessageId || null,
          telnyxMessageId: result.telnyxMessageId || null,
          lastError: null,
        },
      });
      return { ok: true, sent: true };
    }

    if (result.outcome === "unknown") {
      await prisma.arReminderDispatch.update({
        where: { id: dispatchId },
        data: { status: "unknown", unknownSince: new Date(), lastError: result.detail },
      });
      return { ok: false, reason: "unknown_submission" };
    }

    await prisma.arReminderDispatch.update({
      where: { id: dispatchId },
      data: { status: "failed", lastError: result.detail || "send_failed" },
    });
    const { notifyArStaffOfReminderDeliveryFailure } = await import(
      "@/lib/appointment-reminders/ar-staff-delivery-alert"
    );
    await notifyArStaffOfReminderDeliveryFailure({
      workspaceId: dispatch.workspaceId,
      appointmentId: dispatch.appointmentId,
      timelineType: dispatch.timelineType,
      detail: result.detail || "send_failed",
    }).catch(() => undefined);
    return { ok: false, reason: result.detail || "send_failed" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = /timeout|ETIMEDOUT|ECONNRESET/i.test(message);
    if (isTimeout) {
      await prisma.arReminderDispatch.update({
        where: { id: dispatchId },
        data: { status: "unknown", unknownSince: new Date(), lastError: message },
      });
      return { ok: false, reason: "unknown_timeout" };
    }
    await prisma.arReminderDispatch.update({
      where: { id: dispatchId },
      data: { status: "failed", lastError: message },
    });
    const { notifyArStaffOfReminderDeliveryFailure } = await import(
      "@/lib/appointment-reminders/ar-staff-delivery-alert"
    );
    await notifyArStaffOfReminderDeliveryFailure({
      workspaceId: dispatch.workspaceId,
      appointmentId: dispatch.appointmentId,
      timelineType: dispatch.timelineType,
      detail: message,
    }).catch(() => undefined);
    throw err;
  }
}
