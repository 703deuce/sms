import type { MctbBookingSlot } from "@/lib/mctb/ai-booking/types";
import type { MctbAiBookingSession } from "@/lib/mctb/ai-booking/types";
import type { MctbAiBookingWorkspaceConfig } from "@/lib/mctb/ai-booking/config";
import type { MctbSemanticConversationContext } from "@/lib/mctb/semantic-conversation-context";
import { schedulingSpecialistUserPayloadFromContext } from "@/lib/mctb/semantic-conversation-context";

/** Build the JSON user payload for the scheduling specialist — single source of truth. */
export function buildSchedulingSpecialistUserPayload(input: {
  message: string;
  timezone: string;
  nowIso: string;
  offeredSlots: MctbBookingSlot[];
  aiBookingSessionActive: boolean;
  sessionStage?: string | null;
  bookingAuthorized?: boolean;
  session?: MctbAiBookingSession | null;
  bookingConfig?: MctbAiBookingWorkspaceConfig | null;
  semanticContext?: MctbSemanticConversationContext | null;
}): string {
  if (input.semanticContext) {
    const business_constraints = input.bookingConfig
      ? {
          service_name: input.bookingConfig.serviceName ?? null,
          duration_minutes: input.bookingConfig.durationMinutes ?? null,
          provider: input.bookingConfig.provider,
          timezone: input.bookingConfig.timezone ?? input.timezone,
        }
      : null;
    const payload = schedulingSpecialistUserPayloadFromContext(input.semanticContext, {
      timezone: input.timezone,
      nowIso: input.nowIso,
      bookingAuthorized: input.bookingAuthorized === true,
      business_constraints,
    });
    return JSON.stringify(payload);
  }

  const offered = input.offeredSlots.map((s, i) => ({
    index: i + 1,
    slot_id: s.slotId,
    start_utc: s.startUtc,
    end_utc: s.endUtc,
    label: s.label,
  }));

  return JSON.stringify({
    conversation: [{ role: "customer", text: input.message }],
    structured_state: {
      workflow_stage: input.sessionStage || input.session?.stage || null,
      booking_session_active: input.aiBookingSessionActive,
      offered_slots: offered,
      last_queried_window: input.session?.lastQueriedWindow ?? null,
      pending_slot_id: input.session?.pendingSlotId ?? null,
    },
    latest_message: input.message,
    timezone: input.timezone,
    current_time_utc: input.nowIso,
    booking_already_authorized: input.bookingAuthorized === true,
  });
}
