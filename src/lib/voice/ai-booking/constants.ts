/** Canonical AI Booking session key for a live voice call (shared with MCTB session store). */
export function voiceBookingConversationId(callId: string): string {
  return `voice:${callId.trim()}`;
}

export const VOICE_AI_BOOKING_JOB_CREATE = "voice_mctb_booking_create";
