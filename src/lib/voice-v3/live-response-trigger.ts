import type { LiveSidebandSend } from "./greeting";

/**
 * GPT-Live does not speak after session.thinking.append alone.
 * After authoritative async work (FIND, BOOK, etc.), issue response.create.
 */
export function requestLiveSpeakContinuation(input: {
  send: LiveSidebandSend;
  liveSessionId: string;
  reason: string;
}): void {
  const sessionId = input.liveSessionId.trim();
  if (!sessionId) return;

  const eventId = `voice_v3_speak_${input.reason}_${sessionId}_${Date.now()}`;
  console.log("LIVE_RESPONSE_CREATE_REQUESTED", {
    live_session_id: sessionId,
    reason: input.reason,
    event_id: eventId,
  });

  input.send({
    type: "response.create",
    event_id: eventId,
  });
}
