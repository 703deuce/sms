import type { BusyInterval } from "@/lib/voice/calendar/providers";
import { listAuthoritativeVoiceAppointmentBusyIntervals } from "@/lib/voice/calendar/voice-appointment-reconcile";

/**
 * Transovo ledger busy merged into provider availability.
 * Only provider-confirmed rows and short-lived holds block — not stale cert/test rows.
 */
export async function listWorkspaceAppointmentBusyIntervals(
  workspaceId: string,
  rangeStart: Date,
  rangeEnd: Date,
  bufferMinutes = 0,
): Promise<BusyInterval[]> {
  return listAuthoritativeVoiceAppointmentBusyIntervals(
    workspaceId,
    rangeStart,
    rangeEnd,
    bufferMinutes,
  );
}

export function slotOverlapsBusyIntervals(
  slotStart: Date,
  slotEnd: Date,
  busy: BusyInterval[],
): boolean {
  if (Number.isNaN(slotStart.getTime()) || Number.isNaN(slotEnd.getTime())) return false;
  return busy.some((b) => slotStart < b.end && slotEnd > b.start);
}
