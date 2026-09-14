/**
 * @deprecated Use `@/lib/voice/ai-booking/*` and the MCTB canonical orchestrator.
 */
import "server-only";

export async function processVoiceBookingTranscript(): Promise<never> {
  throw new Error(
    "Use voice_ai_booking_turn / calendar_availability via canonical AI booking — see docs/VOICE-AI-BOOKING.md",
  );
}
