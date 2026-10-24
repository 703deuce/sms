import type { VoiceV3CallContext } from "../state/call-context";
import type { VoiceV3CallRuntime } from "../state/call-runtime";
import type { AgentStateSnapshot } from "./agent-state-snapshot";
import type { ConversationAction } from "./conversation-action";
import { buildSharedCallerFactsLiveSummary } from "../intake-objective/build-shared-caller-facts";

function formatConversationAction(action: ConversationAction): string {
  switch (action.type) {
    case "ASK_REQUIRED_FIELD":
      return `ASK_REQUIRED_FIELD(${action.fieldKey})`;
    case "PRESENT_AVAILABILITY":
      return `PRESENT_AVAILABILITY(${action.offerSetId})`;
    case "ACKNOWLEDGE_PENDING_ACTION":
      return `ACKNOWLEDGE_PENDING_ACTION(${action.operationId})`;
    case "INFORM_TEMPORARY_FAILURE":
      return `INFORM_TEMPORARY_FAILURE(${action.failureCode})`;
    case "CLARIFY_SCHEDULING":
      return `CLARIFY_SCHEDULING(${action.reason})`;
    case "CLARIFY_INTENT":
      return "CLARIFY_INTENT";
    default:
      return action.type;
  }
}

export function buildAgentSnapshotLiveAppend(
  runtime: VoiceV3CallRuntime,
  snapshot: AgentStateSnapshot,
): {
  type: "session.thinking.append";
  content: string;
  delegation_id: null;
} {
  const ctx = runtime.getSnapshot();
  const sharedFacts = buildSharedCallerFactsLiveSummary(runtime.config, ctx);
  const known = snapshot.knownFieldKeys.map((k) => `${k} known`).join(", ") || "(none)";
  const missing = snapshot.missingRequiredFieldKeys.join(", ") || "(none)";
  const ops =
    snapshot.activeOperations.map((o) => `${o.type}:${o.status}`).join(", ") || "(none)";
  const allowed = snapshot.allowedClaims.join(", ") || "(none)";
  const forbidden = snapshot.forbiddenClaims.join(", ") || "(none)";
  const need = formatConversationAction(snapshot.nextConversationAction);
  const sendLinkStrategy = runtime.config.scheduling?.bookingStrategy === "SEND_LINK";
  const linkPending =
    sendLinkStrategy &&
    snapshot.activeGoal === "BOOK_APPOINTMENT" &&
    ctx.bookingLink?.lastSend?.status !== "sent" &&
    ctx.bookingLink?.lastSend?.status !== "already_sent";
  const sendLinkDirective = linkPending
    ? "required_native_tool=send_booking_link(confirmed=true) — call this tool before claiming the booking link was texted; forbidden_claims includes CLAIM_BOOKING_LINK_SENT until success."
    : null;

  const content = [
    "Authoritative agent snapshot (runtime-owned).",
    `state_version=${snapshot.stateVersion}`,
    `goal=${snapshot.activeGoal}`,
    `goal_status=${snapshot.goalStatus}`,
    `captured: ${known}`,
    sharedFacts,
    `missing_required: ${missing}`,
    `scheduling_status=${snapshot.schedulingStatus}`,
    `availability_status=${snapshot.availabilityStatus}`,
    `appointment_status=${snapshot.appointmentStatus}`,
    `active_operations=${ops}`,
    snapshot.blocker ? `blocker=${snapshot.blocker.code}` : "blocker=(none)",
    `next_conversation_need=${need}`,
    `allowed_claims=${allowed}`,
    `forbidden_claims=${forbidden}`,
    `find_ready=${evaluateFindReadyHint(ctx)}`,
    `booking_ready_hint=${evaluateBookingReadyHint(ctx)}`,
    `authoritative_state_version=${snapshot.stateVersion}`,
    "Live: phrase naturally; obey allowed/forbidden claims.",
    "If an earlier snapshot had a lower state_version, ignore its conversational need — only this state_version is authoritative.",
    ...(sendLinkDirective ? [sendLinkDirective] : []),
  ].join("\n");

  return {
    type: "session.thinking.append",
    content,
    delegation_id: null,
  };
}

function evaluateFindReadyHint(ctx: VoiceV3CallContext): string {
  return ctx.availability.status === "pending" ? "in_flight" : "see_rules";
}

function evaluateBookingReadyHint(ctx: VoiceV3CallContext): string {
  return ctx.booking.phase;
}
