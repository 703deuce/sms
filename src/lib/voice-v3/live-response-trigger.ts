import type { LiveSidebandSend } from "./greeting";
import { getVoiceV3LiveResponseCoordinator } from "./delegation/live-response-coordinator";

/**
 * GPT-Live does not speak after session.thinking.append alone.
 * After authoritative async work (FIND, BOOK, recovery, etc.), issue response.create
 * through the delegation-aware coordinator.
 */
export function requestLiveSpeakContinuation(input: {
  send: LiveSidebandSend;
  liveSessionId: string;
  reason: string;
  eventId?: string;
  allowBeforeDelegation?: boolean;
}): void {
  const sessionId = input.liveSessionId.trim();
  if (!sessionId) return;

  const coordinator = getVoiceV3LiveResponseCoordinator(sessionId, input.send);
  coordinator.requestResponseCreate({
    reason: input.reason,
    eventId: input.eventId,
    allowBeforeDelegation: input.allowBeforeDelegation,
  });
}
