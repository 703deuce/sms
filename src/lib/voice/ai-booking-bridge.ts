/**
 * Voice runtime bridge to unified AI booking orchestrator.
 * Call from LiveKit/frontdesk tools instead of parallel booking stacks.
 */
import "server-only";

import { handleVoiceAiBooking } from "@/lib/appointments/ai-booking-orchestrator";

export async function processVoiceBookingTranscript(input: {
  workspaceId: string;
  phone: string;
  transcript: string;
  contactId?: string | null;
}) {
  return handleVoiceAiBooking(
    input.workspaceId,
    input.phone,
    input.transcript,
    input.contactId,
  );
}
