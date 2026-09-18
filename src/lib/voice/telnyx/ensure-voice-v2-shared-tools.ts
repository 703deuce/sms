import "server-only";

import type { VoiceV2SharedToolIds } from "./voice-v2-shared-tools";

/**
 * Voice V2 Telnyx booking webhooks are removed — receptionist booking uses Voice V3 Basic only.
 * Wizard publish must not attach find/book/cancel tools to Telnyx assistants.
 */
export async function ensureVoiceV2SharedToolsForAgent(_input: {
  workspaceId: string;
  agentId: string;
  bookingStrategy?: string;
}): Promise<VoiceV2SharedToolIds> {
  console.log("VOICE_V2_SHARED_TOOLS_SKIPPED", {
    reason: "voice_v2_booking_agent_removed",
    hint: "Use Voice V3 Basic PSTN → /api/openai/live/incoming",
  });
  return {
    findId: null,
    bookId: null,
    saveIntakeId: null,
    findExistingId: null,
    rescheduleId: null,
    cancelId: null,
    finalizeRequestId: null,
    sendBookingLinkId: null,
    searchKnowledgeId: null,
    transferCallId: null,
    createCallbackId: null,
  };
}
