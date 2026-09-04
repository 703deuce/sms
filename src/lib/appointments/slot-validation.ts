import "server-only";

import { getPrisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { generateNativeSlots, isBlackoutOrClosed, loadAvailabilityContext } from "@/lib/appointments/availability-engine";

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
  if (Number.isNaN(start.getTime())) throw new Error("Invalid appointment time");
  if (start.getTime() < Date.now() - 60_000) {
    throw new Error("Cannot book a time in the past");
  }

  const ctx = await loadAvailabilityContext(workspaceId, input.serviceName);
  const { platform, service, svcCfg } = ctx;
  if (isBlackoutOrClosed(input.startsAt, platform)) {
    throw new Error("Selected date is unavailable — please choose another day");
  }

  const noticeMs = (ctx.minimumNoticeMinutes || 0) * 60_000;
  if (start.getTime() < Date.now() + noticeMs) {
    throw new Error("This time is too soon — please choose a later slot");
  }

  const maxDays = ctx.maximumDaysAhead || 14;
  const maxDate = Date.now() + maxDays * 86_400_000;
  if (start.getTime() > maxDate) {
    throw new Error("This time is outside the booking window");
  }

  if (!service) throw new Error("Appointment type not found");
  if (svcCfg.enabled === false) throw new Error("This appointment type is not bookable");

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
  if (conflict) throw new Error("That time slot is no longer available");

  const { slots } = await generateNativeSlots(workspaceId, {
    serviceName: input.serviceName,
    daysAhead: Math.min(maxDays, 21),
    timezone: ctx.timezone,
  });
  const startMs = start.getTime();
  const allowed = slots.some((slot) => {
    const slotMs = new Date(slot.startsAt).getTime();
    return Math.abs(slotMs - startMs) < 60_000;
  });
  if (!allowed) throw new Error("Selected time is not available — please choose another slot");

  const limits = svcCfg.bookingLimits || platform.bookingLimits;
  if (limits) {
    const { checkBookingLimits } = await import("@/lib/appointments/scheduling-domain");
    const limitCheck = await checkBookingLimits(workspaceId, input.serviceName, start, limits);
    if (!limitCheck.allowed) throw new Error(limitCheck.reason || "Booking limit reached");
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
    if (!cap.available) throw new Error("This group session is full");
  }
}
