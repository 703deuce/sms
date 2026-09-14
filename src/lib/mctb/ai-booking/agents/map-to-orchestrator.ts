import type { SchedulingSpecialistResult } from "@/lib/mctb/ai-booking/agents/types";
import type { OrchestrateAiBookingInput } from "@/lib/mctb/ai-booking/orchestrator";
import { resolveOfferedSlotIdFromSpecialist } from "@/lib/mctb/ai-booking/resolve-offered-slot-from-specialist";
import { schedulingLocalSemanticsToUtcWindow } from "@/lib/mctb/ai-booking/local-time-semantics";
import type { MctbBookingSlot } from "@/lib/mctb/ai-booking/types";

export function mapSpecialistToOrchestratorInput(
  specialist: SchedulingSpecialistResult,
  base: Omit<
    OrchestrateAiBookingInput,
    "windowStartUtc" | "windowEndUtc" | "specificTimeUtc" | "confirmBooking"
  > & { customerMessage: string },
  options?: {
    sessionHasOfferedSlots?: boolean;
    offeredSlots?: MctbBookingSlot[];
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
  const tz = specialist.timezone || base.timezone;

  const resolveSlotId = (): string | null =>
    resolveOfferedSlotIdFromSpecialist(specialist, offeredSlots, tz);

  if (specialist.action === "SELECT_OFFERED_SLOT" || specialist.action === "CONFIRM_BOOKING") {
    const selectedSlotId = resolveSlotId();
    if (options?.sessionHasOfferedSlots && offeredSlots.length > 0 && !selectedSlotId) {
      return null;
    }
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
