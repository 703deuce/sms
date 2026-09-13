import type { SchedulingSpecialistResult } from "@/lib/mctb/ai-booking/agents/types";
import type { OrchestrateAiBookingInput } from "@/lib/mctb/ai-booking/orchestrator";

export function mapSpecialistToOrchestratorInput(
  specialist: SchedulingSpecialistResult,
  base: Omit<
    OrchestrateAiBookingInput,
    "windowStartUtc" | "windowEndUtc" | "specificTimeUtc" | "choiceUtterance" | "confirmBooking"
  > & { customerMessage: string },
): OrchestrateAiBookingInput | null {
  if (specialist.needs_clarification && specialist.action === "ASK_CLARIFICATION") {
    return null;
  }

  const now = new Date();
  const defaultEnd = new Date(now.getTime() + 48 * 3600_000).toISOString();

  if (specialist.action === "SELECT_OFFERED_SLOT" || specialist.action === "CONFIRM_BOOKING") {
    return {
      ...base,
      windowStartUtc: specialist.window_start || now.toISOString(),
      windowEndUtc: specialist.window_end || defaultEnd,
      timezone: specialist.timezone,
      specificTimeUtc: null,
      selectedSlotId: specialist.offered_slot_id,
      choiceUtterance: base.customerMessage,
      confirmBooking: specialist.action === "CONFIRM_BOOKING",
    };
  }

  if (specialist.action === "CHECK_SPECIFIC_TIME") {
    return {
      ...base,
      windowStartUtc:
        specialist.window_start ||
        new Date(new Date(specialist.requested_start!).getTime() - 3600_000).toISOString(),
      windowEndUtc:
        specialist.window_end ||
        new Date(new Date(specialist.requested_start!).getTime() + 3600_000).toISOString(),
      timezone: specialist.timezone,
      specificTimeUtc: specialist.requested_start || specialist.preferred_time,
      choiceUtterance: null,
      confirmBooking: false,
    };
  }

  return {
    ...base,
    windowStartUtc: specialist.window_start || now.toISOString(),
    windowEndUtc: specialist.window_end || defaultEnd,
    timezone: specialist.timezone,
    specificTimeUtc: specialist.preferred_time || null,
    choiceUtterance: null,
    confirmBooking: false,
  };
}
