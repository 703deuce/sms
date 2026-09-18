import type { AgentStateSnapshot } from "./agent-state-snapshot";
import type { ConversationAction } from "./conversation-action";
import { requestLiveSpeakContinuation } from "../live-response-trigger";
import type { LiveSendFn } from "./after-state-change";

export type ConversationActionDisposition = "SPEAK" | "LISTEN" | "WAIT_FOR_OPERATION" | "NONE";

const lastSpeakKeyBySession = new Map<string, string>();

export function conversationActionDisposition(action: ConversationAction): ConversationActionDisposition {
  switch (action.type) {
    case "ASK_REQUIRED_FIELD":
    case "ASK_SCHEDULING_DATE":
    case "ASK_SCHEDULING_TIME":
    case "CLARIFY_SCHEDULING":
    case "CLARIFY_INTENT":
    case "PRESENT_AVAILABILITY":
    case "CLARIFY_SLOT_SELECTION":
    case "CONFIRM_CANCELLATION":
    case "VERIFY_CALLER":
    case "INFORM_RESULT":
    case "INFORM_TEMPORARY_FAILURE":
    case "OFFER_HANDOFF":
    case "ASK_ANYTHING_ELSE":
    case "END_CALL":
      return "SPEAK";
    case "ACKNOWLEDGE_PENDING_ACTION":
      return "WAIT_FOR_OPERATION";
    case "NONE":
    default:
      return "NONE";
  }
}

function actionIdentity(action: ConversationAction): string {
  switch (action.type) {
    case "ASK_REQUIRED_FIELD":
      return `${action.type}:${action.fieldKey}`;
    case "PRESENT_AVAILABILITY":
      return `${action.type}:${action.offerSetId}`;
    case "ACKNOWLEDGE_PENDING_ACTION":
      return `${action.type}:${action.operationId}`;
    case "INFORM_TEMPORARY_FAILURE":
      return `${action.type}:${action.failureCode}`;
    case "CLARIFY_SCHEDULING":
      return `${action.type}:${action.reason}`;
    case "OFFER_HANDOFF":
      return `${action.type}:${action.reason}`;
    default:
      return action.type;
  }
}

function buildCommentaryForAction(action: ConversationAction): string | null {
  switch (action.type) {
    case "ASK_REQUIRED_FIELD":
      return `Ask the caller naturally for their ${action.fieldKey} (required for booking). Do not repeat fields already captured.`;
    case "ASK_SCHEDULING_DATE":
      return "Ask what day works for their appointment. Do not invent availability.";
    case "ASK_SCHEDULING_TIME":
      return "Ask what time or part of day works. Do not invent slots.";
    case "CLARIFY_INTENT":
      return "Ask one short question to clarify whether they want to book, reschedule, cancel, or something else.";
    case "CLARIFY_SCHEDULING":
      return `Clarify scheduling: ${action.reason}`;
    case "PRESENT_AVAILABILITY":
      return "Offer specific available times from the authoritative offer set in thinking context. Do not invent times.";
    case "CLARIFY_SLOT_SELECTION":
      return "Ask which offered time they prefer.";
    case "INFORM_TEMPORARY_FAILURE":
      return `Explain briefly there is a temporary issue (${action.failureCode}) and offer a safe next step.`;
    default:
      return null;
  }
}

export function syncPlannerSpeakToLive(input: {
  liveSessionId: string;
  snapshot: AgentStateSnapshot;
  send?: LiveSendFn;
}): void {
  const sessionId = input.liveSessionId.trim();
  if (!sessionId || !input.send) return;

  const action = input.snapshot.nextConversationAction;
  const disposition = conversationActionDisposition(action);
  if (disposition !== "SPEAK") return;

  const speakKey = `${input.snapshot.stateVersion}:${actionIdentity(action)}`;
  const prev = lastSpeakKeyBySession.get(sessionId);
  if (prev === speakKey) return;
  lastSpeakKeyBySession.set(sessionId, speakKey);

  const commentary = buildCommentaryForAction(action);
  if (commentary) {
    const eventId = `voice_v3_commentary_${sessionId}_${input.snapshot.stateVersion}`;
    console.log("LIVE_COMMENTARY_SENT", {
      live_session_id: sessionId,
      state_version: input.snapshot.stateVersion,
      action: action.type,
      event_id: eventId,
    });
    input.send({
      type: "session.commentary.append",
      event_id: eventId,
      delegation_id: null,
      content: commentary,
    });
  }

  console.log("LIVE_SPEAK_QUEUED", {
    live_session_id: sessionId,
    state_version: input.snapshot.stateVersion,
    action: action.type,
  });

  requestLiveSpeakContinuation({
    send: input.send,
    liveSessionId: sessionId,
    reason: `planner_${action.type.toLowerCase()}`,
    eventId: `voice_v3_planner_speak_${sessionId}_${speakKey}`,
  });
}

export function clearLiveSpeakSync(liveSessionId: string): void {
  lastSpeakKeyBySession.delete(liveSessionId.trim());
}
