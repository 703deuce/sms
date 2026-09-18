import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { buildCallerMeaningZodSchema } from "./caller-meaning-schema";

export const EMIT_CALLER_MEANING_TOOL_NAME = "emit_caller_meaning";

/**
 * Semantic-only transport: strict function arguments mirror CallerMeaning schema.
 * Not a workflow tool — does not call external systems.
 */
export function buildEmitCallerMeaningLiveFunctionTool(
  agentConfig: VoiceV3AgentConfig,
): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: EMIT_CALLER_MEANING_TOOL_NAME,
    parameters: buildCallerMeaningZodSchema(agentConfig),
    description:
      "Emit structured caller meaning only. Call once per interpretation with captured fields, scheduling semantics, corrections, and ambiguities. Never include workflow, booking, or calendar fields.",
  });

  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}
