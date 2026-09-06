import "server-only";

import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import {
  dispatchAppointmentWorkflowTrigger,
  invalidateWorkflowExecutionsForAppointment,
} from "@/lib/appointment-workflows/engine";
import { wallTimeInZoneToUtc, zonedDateParts } from "@/lib/voice/calendar/timezone-slots";
import { listActiveWorkflowsForTrigger } from "@/lib/appointment-workflows/service";
import { onAppointmentCompleted, onAppointmentNoShow } from "@/lib/appointment-workflows/triggers";
import { resolveStepScheduledTime } from "@/lib/appointment-workflows/scheduler";
import type { AppointmentWorkflowStep } from "@/lib/appointment-workflows/types";

const BEFORE_WINDOWS_MINUTES = [15, 30, 60, 120, 1440] as const;

/** Scan upcoming appointments and fire before_appointment / after_appointment workflow triggers. */
export async function scanAppointmentWorkflowTimeTriggers() {
  const prisma = getPrisma();
  const now = Date.now();
  let dispatched = 0;

  for (const minutes of BEFORE_WINDOWS_MINUTES) {
    const windowStart = new Date(now + minutes * 60_000 - 3 * 60_000);
    const windowEnd = new Date(now + minutes * 60_000 + 3 * 60_000);
    const rows = await prisma.voiceAppointment.findMany({
      where: {
        startsAt: { gte: windowStart, lte: windowEnd },
        status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
      },
      take: 200,
    });

    for (const appt of rows) {
      const workflows = await listActiveWorkflowsForTrigger(appt.workspaceId, "before_appointment");
      if (!workflows.length) continue;
      const key = `before:${appt.id}:${minutes}`;
      try {
        await enqueueJob({
          jobType: "appointment_workflow_time_trigger",
          workspaceId: appt.workspaceId,
          payload: {
            appointmentId: appt.id,
            trigger: "before_appointment",
            minutesBefore: minutes,
          },
          idempotencyKey: key,
        });
        dispatched += 1;
      } catch {
        // duplicate
      }
    }
  }

  const ended = await prisma.voiceAppointment.findMany({
    where: {
      endsAt: { not: null, lt: new Date(now), gte: new Date(now - 10 * 60_000) },
      status: { notIn: ["canceled", "cancelled", "no_show"] },
    },
    take: 200,
  });

  for (const appt of ended) {
    const workflows = await listActiveWorkflowsForTrigger(appt.workspaceId, "after_appointment");
    if (!workflows.length) continue;
    try {
      await enqueueJob({
        jobType: "appointment_workflow_time_trigger",
        workspaceId: appt.workspaceId,
        payload: { appointmentId: appt.id, trigger: "after_appointment" },
        idempotencyKey: `after:${appt.id}`,
      });
      dispatched += 1;
    } catch {
      // duplicate
    }
  }

  return { ok: true, dispatched };
}

export async function processAppointmentWorkflowTimeTrigger(payload: {
  workspaceId: string;
  appointmentId: string;
  trigger: "before_appointment" | "after_appointment";
  minutesBefore?: number;
}) {
  await dispatchAppointmentWorkflowTrigger({
    workspaceId: payload.workspaceId,
    appointmentId: payload.appointmentId,
    trigger: payload.trigger,
  });
  return { ok: true };
}

/** Auto-complete past appointments and fire appointment_completed workflows. */
export async function scanAndCompletePastAppointments() {
  const prisma = getPrisma();
  const now = new Date();
  let completed = 0;

  const rows = await prisma.voiceAppointment.findMany({
    where: {
      endsAt: { not: null, lt: now },
      status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
    },
    take: 200,
  });

  for (const appt of rows) {
    await prisma.voiceAppointment.update({
      where: { id: appt.id },
      data: { status: "completed" },
    });
    await onAppointmentCompleted(appt.workspaceId, appt.id);
    completed += 1;
  }

  return { ok: true, completed };
}

/** Mark no-shows when appointment start passed without check-in. */
export async function scanAppointmentNoShows(graceMinutes = 30) {
  const prisma = getPrisma();
  const cutoff = new Date(Date.now() - graceMinutes * 60_000);
  const rows = await prisma.voiceAppointment.findMany({
    where: {
      startsAt: { lt: cutoff },
      endsAt: { gt: new Date() },
      status: { in: ["scheduled", "awaiting_confirmation", "confirmed"] },
    },
    take: 100,
  });

  let marked = 0;
  for (const appt of rows) {
    const meta = (appt.metadata || {}) as { checkedIn?: boolean };
    if (meta.checkedIn) continue;
    await prisma.voiceAppointment.update({
      where: { id: appt.id },
      data: { status: "no_show" },
    });
    await onAppointmentNoShow(appt.workspaceId, appt.id);
    marked += 1;
  }
  return { ok: true, marked };
}

export async function emitBookingRequested(
  workspaceId: string,
  appointmentId: string,
  contactId?: string | null,
) {
  await dispatchAppointmentWorkflowTrigger({
    workspaceId,
    appointmentId,
    trigger: "booking_requested",
    contactId,
  });
}

export async function emitBookingApproved(workspaceId: string, appointmentId: string) {
  await dispatchAppointmentWorkflowTrigger({
    workspaceId,
    appointmentId,
    trigger: "booking_approved",
  });
}

export async function emitBookingRejected(workspaceId: string, appointmentId: string) {
  await dispatchAppointmentWorkflowTrigger({
    workspaceId,
    appointmentId,
    trigger: "booking_rejected",
  });
  await invalidateWorkflowExecutionsForAppointment(workspaceId, appointmentId, "booking_rejected");
}

export async function emitWaitlistSlotAvailable(
  workspaceId: string,
  appointmentId: string,
  waitlistEntryId: string,
) {
  await dispatchAppointmentWorkflowTrigger({
    workspaceId,
    appointmentId,
    trigger: "waitlist_slot_available",
    contactId: waitlistEntryId,
  });
}

export async function emitUnknownReplyTrigger(
  workspaceId: string,
  appointmentId: string,
  replyBody: string,
) {
  await dispatchAppointmentWorkflowTrigger({
    workspaceId,
    appointmentId,
    trigger: "appointment_status_changed",
  });
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) return;
  const meta = (row.metadata || {}) as Record<string, unknown>;
  await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: {
      metadata: {
        ...meta,
        lastUnknownReply: replyBody.slice(0, 500),
        lastUnknownReplyAt: new Date().toISOString(),
      } as object,
    },
  });
}

export function scheduleWorkflowStepAtTimeOfDay(
  step: AppointmentWorkflowStep,
  appointmentStartsAt: Date,
  appointmentEndsAt: Date | null,
  bookingCreatedAt: Date,
  timeOfDay: { at: string; daysBefore: number },
  timezone: string,
): Date | null {
  const [hh, mm] = timeOfDay.at.split(":").map(Number);
  const anchor = new Date(appointmentStartsAt);
  anchor.setDate(anchor.getDate() - timeOfDay.daysBefore);
  const parts = zonedDateParts(anchor, timezone);
  return wallTimeInZoneToUtc(timezone, parts.year, parts.month, parts.day, hh || 9, mm || 0);
}
