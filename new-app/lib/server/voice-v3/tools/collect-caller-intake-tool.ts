import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceToolDefinition } from "./types";
import { voiceToolError } from "./types";

export const COLLECT_CALLER_INTAKE_TOOL_NAME = "collect_caller_intake";

const OPERATIONS = [
  "book_appointment",
  "request_callback",
  "take_message",
  "send_booking_link",
] as const;

export type CollectCallerIntakeArgs = {
  operation?: (typeof OPERATIONS)[number] | null;
  reason?: string | null;
};

export const COLLECT_CALLER_INTAKE_TOOL_DESCRIPTION = `Start or continue LiveKit-native caller intake for configured business fields (name, phone, email, address, custom wizard fields, etc.).

Use when required caller information is still missing for the current operation (booking, callback, message, etc.) and the caller is ready to provide it.

This runs a short LiveKit AgentTask in the Python voice worker — it can capture multiple fields from one caller statement, reuse conversation history, and run specialized phone/email collectors only when needed.

Do not use for scheduling dates/times (use set_scheduling_preference). Do not use when all required intake is already saved — proceed with booking, callback, or the caller's request instead.`;

export function buildCollectCallerIntakeOpenAiTool(_config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: COLLECT_CALLER_INTAKE_TOOL_NAME,
    parameters: z.object({
      operation: z
        .enum(OPERATIONS)
        .nullable()
        .optional()
        .describe("Operation driving required fields; omit to use the active runtime operation."),
      reason: z
        .string()
        .nullable()
        .optional()
        .describe("Optional short reason for telemetry (not shown to caller)."),
    }),
    description: COLLECT_CALLER_INTAKE_TOOL_DESCRIPTION,
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}

/** Executed only in the LiveKit Python worker — Node must not run collection dialogue. */
export const collectCallerIntakeTool: VoiceToolDefinition<CollectCallerIntakeArgs> = {
  name: COLLECT_CALLER_INTAKE_TOOL_NAME,
  description: COLLECT_CALLER_INTAKE_TOOL_NAME,
  parameters: {},
  validate: (raw) => (raw && typeof raw === "object" ? (raw as CollectCallerIntakeArgs) : {}),
  execute: async () =>
    voiceToolError(
      "PYTHON_WORKER_REQUIRED",
      "collect_caller_intake runs in the LiveKit Python worker, not on Node.",
      {},
      "error",
      false,
    ),
};
