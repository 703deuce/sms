import { getPrisma } from "@/lib/db";
import type { BusyInterval } from "@/lib/voice/calendar/providers";

/**
 * Confirmed Transovo appointments block availability the same as provider busy time.
 * Covers MCTB/voice bookings immediately, even if Graph/Google busy is stale.
 */
export async function listWorkspaceAppointmentBusyIntervals(
  workspaceId: string,
  rangeStart: Date,
  rangeEnd: Date,
  bufferMinutes = 0,
): Promise<BusyInterval[]> {
  const bufferMs = Math.max(0, bufferMinutes) * 60_000;
  const prisma = getPrisma();
  const rows = await prisma.voiceAppointment.findMany({
    where: {
      workspaceId,
      status: { not: "cancelled" },
      startsAt: { lte: new Date(rangeEnd.getTime() + bufferMs) },
      endsAt: { gte: new Date(rangeStart.getTime() - bufferMs) },
    },
    select: { startsAt: true, endsAt: true },
  });

  return rows.map((row) => ({
    start: new Date(row.startsAt.getTime() - bufferMs),
    end: new Date(row.endsAt.getTime() + bufferMs),
  }));
}

export function slotOverlapsBusyIntervals(
  slotStart: Date,
  slotEnd: Date,
  busy: BusyInterval[],
): boolean {
  if (Number.isNaN(slotStart.getTime()) || Number.isNaN(slotEnd.getTime())) return false;
  return busy.some((b) => slotStart < b.end && slotEnd > b.start);
}
