import crypto from "node:crypto";
import { resolveOpenAiLiveBaseline, resolveOpenAiLiveGreetingLine } from "./live-config";

function liveGreetingEventId(suffix: string): string {
  return `live_greet_${suffix}_${crypto.randomUUID()}`;
}

export function shouldSendLiveOpeningGreetingAfterSessionStarted(): boolean {
  return resolveOpenAiLiveBaseline() === "G";
}

export function buildLiveOpeningGreetingInstructionAppend(): Record<string, unknown> {
  const greetingLine = resolveOpenAiLiveGreetingLine();
  const eventId = liveGreetingEventId("instr");
  return {
    type: "session.instructions.append",
    event_id: eventId,
    delegation_id: null,
    content: [
      "Speak in English.",
      "Greet the caller immediately without waiting for them to speak.",
      `Say exactly: ${greetingLine}`,
      "Then pause and listen for the caller.",
      "Do not say any recording or compliance disclosure unless the application sends one later.",
    ].join(" "),
  };
}

export function buildLiveOpeningGreetingKickoffCommentary(): Record<string, unknown> {
  return {
    type: "session.commentary.append",
    event_id: liveGreetingEventId("kick"),
    delegation_id: null,
    content: "Begin the conversation now, following the instructions provided.",
  };
}

export function isLiveInstructionsAppendedAck(
  event: Record<string, unknown>,
  expectedEventId: string,
): boolean {
  if (String(event.type || "") !== "session.instructions.appended") return false;
  const clientId = String(event.client_event_id ?? event.event_id ?? "");
  return clientId === expectedEventId;
}
