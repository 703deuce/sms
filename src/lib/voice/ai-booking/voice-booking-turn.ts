import "server-only";

import { executeVoiceNativeBookingAction } from "@/lib/voice/ai-booking/execute-voice-native-booking";
import type { VoiceNativeBookingPayload } from "@/lib/voice/ai-booking/voice-native-booking-types";

export async function executeVoiceAiBookingTurn(input: {
  workspaceId: string;
  agentId?: string | null;
  callId: string;
  utterance: string;
  confirmBooking?: boolean;
  offeredSlotId?: string | null;
  voiceNative?: VoiceNativeBookingPayload | null;
  actionEpochAtEnqueue?: number | null;
}) {
  if (input.voiceNative) {
    return executeVoiceNativeBookingAction({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callId: input.callId,
      payload: input.voiceNative,
      actionEpochAtEnqueue: input.actionEpochAtEnqueue,
    });
  }

  if (process.env.VOICE_LEGACY_UTTERANCE_BOOKING === "1" && input.utterance.trim()) {
    const { executeVoiceLegacyUtteranceBookingTurn } = await import(
      "@/lib/voice/ai-booking/voice-legacy-utterance-booking-turn"
    );
    return executeVoiceLegacyUtteranceBookingTurn(input);
  }

  return {
    ok: false,
    speak: "I need a structured booking action from the voice tool — not raw utterance text.",
    error: "voice_native_structured_action_required",
    data: {
      needs_structured_action: true,
      hint: "Use voice_ai_booking_turn with action FIND_AVAILABILITY | BOOK_OFFERED_SLOT | …",
    },
  };
}
