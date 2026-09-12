import "server-only";

import { getPrisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { generateNativeSlots, isBlackoutOrClosed, loadAvailabilityContext } from "@/lib/appointments/availability-engine";
import { SchedulingConflictError } from "@/lib/appointments/scheduling-conflict-error";

type Db = Prisma.TransactionClient | ReturnType<typeof getPrisma>;

function dbClient(tx?: Db): Db {
  return tx || getPrisma();
}

/** Shared gate for admin + public booking — same availability source of truth. */
export async function assertSlotAvailableForBooking(
  workspaceId: string,
  input: {
    serviceName: string;
    startsAt: string;
    excludeAppointmentId?: string;
  },
  tx?: Db,
) {
  const start = new Date(input.startsAt);
  if (Number.isNaN(start.getTime())) {
    throw new SchedulingConflictError("INVALID_TIME", "Invalid appointment time.");
  }
  if (start.getTime() < Date.now() - 60_000) {
    throw new SchedulingConflictError("INVALID_TIME", "Cannot book a time in the past.");
  }

  const ctx = await loadAvailabilityContext(workspaceId, input.serviceName);
  const { platform, service, svcCfg } = ctx;
  if (isBlackoutOrClosed(input.startsAt, platform)) {
    throw new SchedulingConflictError("BLACKOUT", "Selected date is unavailable — please choose another day.");
  }

  const noticeMs = (ctx.minimumNoticeMinutes || 0) * 60_000;
  if (start.getTime() < Date.now() + noticeMs) {
    throw new SchedulingConflictError("TOO_SOON", "This time is too soon — please choose a later slot.");
  }

  const maxDays = ctx.maximumDaysAhead || 14;
  const maxDate = Date.now() + maxDays * 86_400_000;
  if (start.getTime() > maxDate) {
    throw new SchedulingConflictError("OUTSIDE_WINDOW", "This time is outside the booking window.");
  }

  if (!service) throw new SchedulingConflictError("SERVICE_DISABLED", "Appointment type not found.");
  if (svcCfg.enabled === false) {
    throw new SchedulingConflictError("SERVICE_DISABLED", "This appointment type is not bookable.");
  }

  const durationMinutes = service.durationMinutes || 30;
  const bufferBefore = (svcCfg.bufferBeforeMinutes || 0) * 60_000;
  const bufferAfter = (svcCfg.bufferAfterMinutes || service.bufferMinutes || 0) * 60_000;
  const endsAt = new Date(start.getTime() + durationMinutes * 60_000);
  const prisma = dbClient(tx);

  const conflict = await prisma.voiceAppointment.findFirst({
    where: {
      workspaceId,
      ...(input.excludeAppointmentId ? { id: { not: input.excludeAppointmentId } } : {}),
      startsAt: { lte: new Date(endsAt.getTime() + bufferAfter) },
      endsAt: { gte: new Date(start.getTime() - bufferBefore) },
      status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
    },
  });
  if (conflict) {
    if (input.excludeAppointmentId && conflict.id === input.excludeAppointmentId) {
      throw new SchedulingConflictError(
        "SELF_CONFLICT",
        "Reschedule validation incorrectly matched the appointment being moved. This has been logged.",
      );
    }
    const staff = conflict.staffName ? `${conflict.staffName} is unavailable at this time.` : null;
    throw new SchedulingConflictError(
      "SLOT_TAKEN",
      staff || "That time slot is already booked.",
    );
  }

  let { slots } = await generateNativeSlots(workspaceId, {
    serviceName: input.serviceName,
    daysAhead: Math.min(maxDays, 21),
    timezone: ctx.timezone,
    excludeAppointmentId: input.excludeAppointmentId,
  });
  const { resolveResourceIdsForBookingType, filterSlotsByResourceAvailability } = await import(
    "@/lib/appointments/service-booking/resource-availability"
  );
  const resourceIds = await resolveResourceIdsForBookingType(workspaceId, svcCfg);
  if (resourceIds.length) {
    slots = await filterSlotsByResourceAvailability(
      workspaceId,
      resourceIds,
      slots,
      input.excludeAppointmentId,
    );
  }
  const startMs = start.getTime();
  const allowed = slots.some((slot) => {
    const slotMs = new Date(slot.startsAt).getTime();
    return Math.abs(slotMs - startMs) < 60_000;
  });
  if (!allowed) {
    throw new SchedulingConflictError(
      "NOT_IN_AVAILABILITY",
      "This time is not on the bookable schedule for this service.",
    );
  }

  const limits = svcCfg.bookingLimits || platform.bookingLimits;
  if (limits) {
    const { checkBookingLimits } = await import("@/lib/appointments/scheduling-domain");
    const limitCheck = await checkBookingLimits(workspaceId, input.serviceName, start, limits);
    if (!limitCheck.allowed) {
      throw new SchedulingConflictError("BOOKING_LIMIT", limitCheck.reason || "Booking limit reached.");
    }
  }

  const capacity = svcCfg.groupBooking?.enabled ? svcCfg.groupBooking.capacity || 1 : 1;
  if (capacity > 1) {
    const { checkGroupCapacity } = await import("@/lib/appointments/scheduling-domain");
    const cap = await checkGroupCapacity(
      workspaceId,
      input.serviceName,
      start,
      capacity,
      input.excludeAppointmentId,
    );
    if (!cap.available) {
      throw new SchedulingConflictError("GROUP_FULL", "This group session is full.");
    }
  }
}
