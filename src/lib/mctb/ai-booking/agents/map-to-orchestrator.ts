import type { SchedulingSpecialistResult } from "@/lib/mctb/ai-booking/agents/types";
import type { OrchestrateAiBookingInput } from "@/lib/mctb/ai-booking/orchestrator";
import {
  resolveOfferedSlotIdByLocalWallTime,
  schedulingLocalSemanticsToUtcWindow,
} from "@/lib/mctb/ai-booking/local-time-semantics";

export function mapSpecialistToOrchestratorInput(
  specialist: SchedulingSpecialistResult,
  base: Omit<
    OrchestrateAiBookingInput,
    "windowStartUtc" | "windowEndUtc" | "specificTimeUtc" | "confirmBooking"
  > & { customerMessage: string },
  options?: {
    sessionHasOfferedSlots?: boolean;
    offeredSlots?: { slotId: string }[];
    referenceUtcIso?: string;
  },
): OrchestrateAiBookingInput | null {
  if (specialist.needs_clarification && specialist.action === "ASK_CLARIFICATION") {
    return null;
  }

  const now = new Date();
  const defaultEnd = new Date(now.getTime() + 48 * 3600_000).toISOString();
  const localWindow = schedulingLocalSemanticsToUtcWindow({
    specialist,
    timeZone: specialist.timezone || base.timezone,
    referenceUtcIso: options?.referenceUtcIso || now.toISOString(),
  });

  const offeredSlots = options?.offeredSlots ?? [];

  const resolveSlotId = (): string | null => {
    if (specialist.offered_slot_id) return specialist.offered_slot_id;
    const idx = specialist.offered_slot_index;
    if (idx != null && idx >= 1 && idx <= offeredSlots.length) {
      return offeredSlots[idx - 1]?.slotId ?? null;
    }
    if (specialist.requested_local_date && specialist.requested_local_time && offeredSlots.length) {
      return resolveOfferedSlotIdByLocalWallTime({
        offeredSlots,
        localDate: specialist.requested_local_date,
        localTime: specialist.requested_local_time,
        timeZone: specialist.timezone || base.timezone,
      });
    }
    return null;
  };

  if (specialist.action === "SELECT_OFFERED_SLOT" || specialist.action === "CONFIRM_BOOKING") {
    const selectedSlotId = resolveSlotId();
    const confirmBooking =
      specialist.action === "CONFIRM_BOOKING" || specialist.customer_confirms_booking === true;
    return {
      ...base,
      windowStartUtc: specialist.window_start || now.toISOString(),
      windowEndUtc: specialist.window_end || defaultEnd,
      timezone: specialist.timezone,
      specificTimeUtc: null,
      selectedSlotId,
      confirmBooking,
    };
  }

  if (specialist.action === "CHECK_SPECIFIC_TIME") {
    const selectingAmongOffered =
      options?.sessionHasOfferedSlots === true &&
      Boolean(specialist.requested_start || specialist.preferred_time);
    const selectedSlotId = selectingAmongOffered ? resolveSlotId() : null;
    const win =
      localWindow ||
      (specialist.requested_start
        ? {
            windowStartUtc: new Date(new Date(specialist.requested_start).getTime() - 3600_000).toISOString(),
            windowEndUtc: new Date(new Date(specialist.requested_start).getTime() + 3600_000).toISOString(),
            specificTimeUtc: specialist.requested_start,
          }
        : null);
    return {
      ...base,
      windowStartUtc: win?.windowStartUtc ?? specialist.window_start ?? now.toISOString(),
      windowEndUtc: win?.windowEndUtc ?? specialist.window_end ?? defaultEnd,
      timezone: specialist.timezone,
      specificTimeUtc: win?.specificTimeUtc ?? specialist.requested_start ?? specialist.preferred_time,
      selectedSlotId,
      confirmBooking:
        specialist.action === "CONFIRM_BOOKING" || specialist.customer_confirms_booking === true,
    };
  }

  if (localWindow) {
    return {
      ...base,
      windowStartUtc: localWindow.windowStartUtc,
      windowEndUtc: localWindow.windowEndUtc,
      timezone: specialist.timezone,
      specificTimeUtc: localWindow.specificTimeUtc,
      confirmBooking: false,
    };
  }

  return {
    ...base,
    windowStartUtc: specialist.window_start || now.toISOString(),
    windowEndUtc: specialist.window_end || defaultEnd,
    timezone: specialist.timezone,
    specificTimeUtc: specialist.preferred_time || specialist.requested_start || null,
    confirmBooking: false,
  };
}
