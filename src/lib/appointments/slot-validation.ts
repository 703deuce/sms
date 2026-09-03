import "server-only";

import { getPrisma } from "@/lib/db";
import { getAvailability } from "@/lib/voice/calendar/booking";

/** Shared gate for admin + public booking — same availability source of truth. */
export async function assertSlotAvailableForBooking(
  workspaceId: string,
  input: {
    serviceName: string;
    startsAt: string;
    excludeAppointmentId?: string;
  },
) {
  const start = new Date(input.startsAt);
  if (Number.isNaN(start.getTime())) throw new Error("Invalid appointment time");
  if (start.getTime() < Date.now() - 60_000) {
    throw new Error("Cannot book a time in the past");
  }

  const prisma = getPrisma();
  const service = await prisma.voiceService.findFirst({
    where: { workspaceId, name: input.serviceName },
  });
  if (!service) throw new Error("Appointment type not found");
  const svcCfg = (service.config || {}) as { enabled?: boolean };
  if (svcCfg.enabled === false) throw new Error("This appointment type is not bookable");

  const durationMinutes = service.durationMinutes || 30;
  const bufferMs = (service.bufferMinutes || 0) * 60_000;
  const endsAt = new Date(start.getTime() + durationMinutes * 60_000);

  const conflict = await prisma.voiceAppointment.findFirst({
    where: {
      workspaceId,
      ...(input.excludeAppointmentId ? { id: { not: input.excludeAppointmentId } } : {}),
      startsAt: { lte: new Date(endsAt.getTime() + bufferMs) },
      endsAt: { gte: new Date(start.getTime() - bufferMs) },
      status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
    },
  });
  if (conflict) throw new Error("That time slot is no longer available");

  const { slots } = await getAvailability(workspaceId, {
    serviceName: input.serviceName,
    daysAhead: 21,
  });
  const startMs = start.getTime();
  const allowed = slots.some((slot) => {
    const slotMs = new Date(slot.startsAt).getTime();
    return Math.abs(slotMs - startMs) < 60_000;
  });
  if (!allowed) throw new Error("Selected time is not available — please choose another slot");
}
