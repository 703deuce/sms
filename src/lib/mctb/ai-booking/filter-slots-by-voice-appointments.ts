import {
  listWorkspaceAppointmentBusyIntervals,
  slotOverlapsBusyIntervals,
} from "@/lib/voice/calendar/appointment-busy";
import type { MctbBookingSlot } from "@/lib/mctb/ai-booking/types";

/**
 * Last-mile filter on provider slots: never offer a time that overlaps a confirmed appointment.
 * Provider busy (Microsoft/Google) handles externally created events; this layer also enforces
 * our VoiceAppointment ledger when the adapter path bypasses getAvailability.
 */
export async function filterSlotsByVoiceAppointments(
  workspaceId: string,
  slots: MctbBookingSlot[],
  options?: { bufferMinutes?: number },
): Promise<MctbBookingSlot[]> {
  if (!slots.length) return slots;

  const starts = slots
    .map((s) => Date.parse(s.startUtc))
    .filter((t) => Number.isFinite(t));
  const ends = slots
    .map((s) => Date.parse(s.endUtc))
    .filter((t) => Number.isFinite(t));
  if (!starts.length || !ends.length) return slots;

  const bufferMinutes = Math.max(0, options?.bufferMinutes ?? 0);
  const rangeStart = new Date(Math.min(...starts));
  const rangeEnd = new Date(Math.max(...ends));

  const busy = await listWorkspaceAppointmentBusyIntervals(
    workspaceId,
    rangeStart,
    rangeEnd,
    bufferMinutes,
  );
  if (!busy.length) return slots;

  return slots.filter((slot) => {
    const slotStart = new Date(slot.startUtc);
    const slotEnd = new Date(slot.endUtc);
    return !slotOverlapsBusyIntervals(slotStart, slotEnd, busy);
  });
}
