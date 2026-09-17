/**
 * Canonical GPT-Live outbound client events — single source of truth for API shape.
 * @see https://developers.openai.com/api/docs/guides/live-delegation
 */

import { liveBaselineEventId } from "./live-event-ids";

export type LiveResponseInputItem = Record<string, unknown>;

export type LiveResponseItemCreate = {
  type: "response.item.create";
  event_id?: string;
  item: LiveResponseInputItem;
};

export type LiveResponseCreate = {
  type: "response.create";
  event_id?: string;
};

export type LiveInstructionsAppend = {
  type: "session.instructions.append";
  event_id?: string;
  delegation_id: string | null;
  content: string;
};

export type LiveThinkingAppend = {
  type: "session.thinking.append";
  event_id?: string;
  delegation_id: string | null;
  content: string;
};

export type LiveCommentaryAppend = {
  type: "session.commentary.append";
  event_id?: string;
  delegation_id: string | null;
  content: string;
};

export type LiveOutboundClientEvent =
  | LiveResponseItemCreate
  | LiveResponseCreate
  | LiveInstructionsAppend
  | LiveThinkingAppend
  | LiveCommentaryAppend
  | Record<string, unknown>;

const FORBIDDEN_DELEGATION_ON = new Set(["response.item.create", "response.create"]);

export function assertLiveOutboundEventContract(event: Record<string, unknown>): void {
  const type = String(event.type || "");
  if (FORBIDDEN_DELEGATION_ON.has(type) && "delegation_id" in event) {
    throw new Error(`Live outbound contract: ${type} must not include delegation_id`);
  }
  if (
    type === "session.instructions.append" ||
    type === "session.thinking.append" ||
    type === "session.commentary.append"
  ) {
    if (!("delegation_id" in event)) {
      throw new Error(`Live outbound contract: ${type} requires delegation_id (use null for session-wide)`);
    }
  }
}

export function buildLiveResponseItemCreate(input: {
  item: LiveResponseInputItem;
  eventIdPrefix?: string;
}): LiveResponseItemCreate {
  return {
    type: "response.item.create",
    event_id: liveBaselineEventId(input.eventIdPrefix ?? "response_item"),
    item: input.item,
  };
}

export function buildLiveResponseCreate(input?: { eventIdPrefix?: string }): LiveResponseCreate {
  return {
    type: "response.create",
    event_id: liveBaselineEventId(input?.eventIdPrefix ?? "response_create"),
  };
}

export function buildLiveInstructionsAppend(input: {
  content: string;
  delegationId?: string | null;
  eventIdPrefix?: string;
}): LiveInstructionsAppend {
  return {
    type: "session.instructions.append",
    event_id: liveBaselineEventId(input.eventIdPrefix ?? "instructions"),
    delegation_id: input.delegationId ?? null,
    content: input.content,
  };
}

export function buildLiveThinkingAppend(input: {
  content: string;
  delegationId?: string | null;
  eventIdPrefix?: string;
}): LiveThinkingAppend {
  return {
    type: "session.thinking.append",
    event_id: liveBaselineEventId(input.eventIdPrefix ?? "thinking"),
    delegation_id: input.delegationId ?? null,
    content: input.content,
  };
}

export function buildLiveCommentaryAppend(input: {
  content: string;
  delegationId?: string | null;
  eventIdPrefix?: string;
}): LiveCommentaryAppend {
  return {
    type: "session.commentary.append",
    event_id: liveBaselineEventId(input.eventIdPrefix ?? "commentary"),
    delegation_id: input.delegationId ?? null,
    content: input.content,
  };
}

export function buildLiveFunctionCallOutputItem(input: {
  callId: string;
  output: string;
}): LiveResponseItemCreate {
  return buildLiveResponseItemCreate({
    eventIdPrefix: `tool_result_${input.callId}`,
    item: {
      type: "function_call_output",
      call_id: input.callId,
      output: input.output,
    },
  });
}

export function buildLiveDelegationDeveloperContextItem(input: {
  developerText: string;
}): LiveResponseItemCreate {
  return buildLiveResponseItemCreate({
    eventIdPrefix: "delegation_ctx",
    item: {
      type: "message",
      role: "developer",
      content: [
        {
          type: "input_text",
          text: input.developerText,
        },
      ],
    },
  });
}
