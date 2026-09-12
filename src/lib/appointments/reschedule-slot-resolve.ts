import "server-only";

import { generateNativeSlots } from "@/lib/appointments/availability-engine";
import { SchedulingConflictError } from "@/lib/appointments/scheduling-conflict-error";

/** Snap a proposed wall time to the nearest canonical slot (staff drag/reschedule). */
export async function snapProposedStartToCanonicalSlot(
  workspaceId: string,
  input: {
    serviceName: string;
    startsAt: string;
    excludeAppointmentId?: string;
    staffId?: string;
    locationId?: string;
    toleranceMinutes?: number;
  },
): Promise<string> {
  const proposedMs = new Date(input.startsAt).getTime();
  if (Number.isNaN(proposedMs)) {
    throw new SchedulingConflictError("INVALID_TIME", "Invalid appointment time.");
  }
  const toleranceMs = (input.toleranceMinutes ?? 90) * 60_000;
  const { slots } = await generateNativeSlots(workspaceId, {
    serviceName: input.serviceName,
    daysAhead: 28,
    excludeAppointmentId: input.excludeAppointmentId,
    staffId: input.staffId,
    locationId: input.locationId,
  });
  if (!slots.length) {
    throw new SchedulingConflictError(
      "NOT_IN_AVAILABILITY",
      "No bookable times are available in this range for this service.",
    );
  }
  let best = slots[0]!.startsAt;
  let bestDist = Math.abs(new Date(best).getTime() - proposedMs);
  for (const slot of slots) {
    const dist = Math.abs(new Date(slot.startsAt).getTime() - proposedMs);
    if (dist < bestDist) {
      bestDist = dist;
      best = slot.startsAt;
    }
  }
  if (bestDist > toleranceMs) {
    throw new SchedulingConflictError(
      "NOT_IN_AVAILABILITY",
      "This time is outside bookable hours or does not match the scheduling grid.",
    );
  }
  return best;
}
