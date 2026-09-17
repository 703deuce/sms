import crypto from "node:crypto";
import { resolveOpenAiLiveBaseline, resolveOpenAiLiveGreetingLine } from "./live-config";
import {
  buildLiveCommentaryAppend,
  buildLiveInstructionsAppend,
} from "./live-outbound-events";

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
    ...buildLiveInstructionsAppend({
      eventIdPrefix: "live_greet_instr",
      content: [
        "Speak in English.",
        "Greet the caller immediately without waiting for them to speak.",
        `Say exactly: ${greetingLine}`,
        "Then pause and listen for the caller.",
        "Do not say any recording or compliance disclosure unless the application sends one later.",
      ].join(" "),
    }),
    event_id: eventId,
  };
}

export function buildLiveOpeningGreetingKickoffCommentary(): Record<string, unknown> {
  return {
    ...buildLiveCommentaryAppend({
      eventIdPrefix: "live_greet_kick",
      content: "Begin the conversation now, following the instructions provided.",
    }),
    event_id: liveGreetingEventId("kick"),
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
