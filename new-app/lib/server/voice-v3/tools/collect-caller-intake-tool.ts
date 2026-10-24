import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceToolDefinition } from "./types";
import { voiceToolError } from "./types";
import { COLLECT_CALLER_INTAKE_TOOL_DESCRIPTION } from "./astra-tool-contracts";

export { COLLECT_CALLER_INTAKE_TOOL_DESCRIPTION };

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
  volunteered_values?: { key: string; value: string }[] | null;
  caller_turn_hint?: string | null;
};

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
      volunteered_values: z
        .array(
          z.object({
            key: z.string().describe("Configured intake field key."),
            value: z.string().describe("Clear value the caller provided."),
          }),
        )
        .nullable()
        .optional()
        .describe(
          "All configured intake fields the caller clearly provided this turn — saved immediately in one batch before any spoken intake.",
        ),
      caller_turn_hint: z
        .string()
        .nullable()
        .optional()
        .describe(
          "ONLY if Amy session history may lag: paste the caller's latest spoken words verbatim (ASR text). Do not paraphrase, infer, or add facts not clearly spoken. Omit when unsure — use volunteered_values for structured facts instead.",
        ),
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
