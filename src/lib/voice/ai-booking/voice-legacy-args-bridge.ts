import type { VoiceNativeBookingPayload } from "@/lib/voice/ai-booking/voice-native-booking-types";
import { parseVoiceNativeBookingPayload } from "@/lib/voice/ai-booking/voice-native-booking-types";
import { localDatePlusDays } from "@/lib/mctb/ai-booking/local-time-semantics";

/**
 * Telnyx assistants published before the structured tool schema still send { utterance }.
 * Bridge to voice-native actions using structural defaults only — no NL regex/LLM.
 */
export function resolveVoiceBookingToolArgs(
  raw: Record<string, unknown>,
  bookingTimezone: string,
  referenceUtcIso: string,
): VoiceNativeBookingPayload | null {
  const parsed = parseVoiceNativeBookingPayload(raw);
  if (parsed.ok) return parsed.payload;

  const offeredSlotId = raw.offered_slot_id ? String(raw.offered_slot_id).trim() : "";
  const confirm = raw.confirm_booking === true || raw.confirm === true;
  if (offeredSlotId) {
    return {
      action: confirm ? "BOOK_OFFERED_SLOT" : "SELECT_OFFERED_SLOT",
      offer_set_id: raw.offer_set_id ? String(raw.offer_set_id) : null,
      selected_slot_id: offeredSlotId,
      confirm_booking: confirm,
      tool_invocation_id: raw.tool_invocation_id
        ? String(raw.tool_invocation_id)
        : raw.invocation_id
          ? String(raw.invocation_id)
          : null,
    };
  }

  const utterance = String(raw.utterance || raw.user_input || raw.caller_message || "").trim();
  if (!utterance) return null;

  const tomorrow = localDatePlusDays(referenceUtcIso, bookingTimezone, 1);
  return {
    action: "FIND_AVAILABILITY",
    requested_date: tomorrow || null,
    tool_invocation_id: raw.tool_invocation_id
      ? String(raw.tool_invocation_id)
      : raw.invocation_id
        ? String(raw.invocation_id)
        : null,
    legacy_utterance_present: true,
  } as VoiceNativeBookingPayload & { legacy_utterance_present?: boolean };
}
