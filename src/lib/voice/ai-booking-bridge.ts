/**
 * @deprecated Appointments outbound voice uses Telnyx press-1 reminders only (see appointment-voice-reminders).
 * This bridge is retained for SMS/email AI booking tests only.
 */
import "server-only";

export async function processVoiceBookingTranscript(): Promise<never> {
  throw new Error("Voice AI booking is not supported. Use Telnyx appointment voice reminders.");
}
