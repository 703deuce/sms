import { zodTextFormat } from "openai/helpers/zod";
import type { ResponsesDelegationConfig } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { resolveVoiceV3AgentConfig, voiceV3IntakePipelineEnabled } from "../state/call-runtime";
import {
  buildCallerMeaningZodSchema,
  CALLER_MEANING_STRUCTURED_OUTPUT_NAME,
} from "./caller-meaning-schema";
import {
  buildEmitCallerMeaningLiveFunctionTool,
  EMIT_CALLER_MEANING_TOOL_NAME,
} from "./emit-caller-meaning-tool";
import { resolveVoiceV3IntakeTransport } from "./intake-transport";
import { voiceV3UsesCapabilityTools } from "./tool-surface";
import { buildVoiceV3AstraFunctionTools } from "../tools/build-openai-tools";

const VOICE_V3_ASTRA_MODEL = "gpt-6-astra";

/**
 * Live `sessions.accept` delegation config (PSTN/SIP).
 *
 * OpenAI Live delegation currently accepts `text.verbosity` only — not
 * `text.format` (Structured Outputs). Sending `format` causes HTTP 400
 * `Unknown parameter: session.delegation.responses.text.format` and the call
 * stays silent because accept never completes.
 *
 * Primary transport: typed capability function tools on delegated Responses,
 * or legacy strict `emit_caller_meaning` when `VOICE_V3_LEGACY_EMIT_CALLER_MEANING=1`.
 *
 * Fallback: `VOICE_V3_INTAKE_TRANSPORT=output_text` — output_text JSON + Zod.
 *
 * Strict JSON schema via `text.format` is only for standalone `responses.parse`
 * integration tests (`voiceV3CallerMeaningTextFormat`).
 */
export function buildVoiceV3AstraDelegationResponses(
  astraInstructions: string,
  agentConfig: VoiceV3AgentConfig = resolveVoiceV3AgentConfig(),
): ResponsesDelegationConfig {
  const intakeEnabled = voiceV3IntakePipelineEnabled();
  const transport = resolveVoiceV3IntakeTransport();
  const useFunctionTool = intakeEnabled && transport === "function_tool";
  const capabilityTools = useFunctionTool && voiceV3UsesCapabilityTools();

  const tools = capabilityTools
    ? buildVoiceV3AstraFunctionTools(agentConfig)
    : useFunctionTool
      ? [buildEmitCallerMeaningLiveFunctionTool(agentConfig)]
      : [];

  return {
    model: VOICE_V3_ASTRA_MODEL,
    instructions: astraInstructions,
    reasoning: {
      effort: "low",
    },
    text: {
      verbosity: "low",
    },
    parallel_tool_calls: capabilityTools,
    tool_choice: capabilityTools
      ? "auto"
      : useFunctionTool
        ? { type: "function", name: EMIT_CALLER_MEANING_TOOL_NAME }
        : "auto",
    max_output_tokens: intakeEnabled ? 768 : 200,
    tools,
  };
}

/** Structured Outputs for standalone Responses API (`responses.parse` tests). */
export function voiceV3CallerMeaningTextFormat(agentConfig: VoiceV3AgentConfig) {
  return zodTextFormat(
    buildCallerMeaningZodSchema(agentConfig),
    CALLER_MEANING_STRUCTURED_OUTPUT_NAME,
  );
}

function delegationTextHasFormat(text: unknown): boolean {
  if (!text || typeof text !== "object") return false;
  const row = text as { format?: unknown };
  return "format" in row && row.format !== undefined;
}

/** Guardrail: Live accept payload must not include unsupported keys. */
export function assertLiveDelegationAcceptPayloadCompatible(
  responses: ResponsesDelegationConfig,
): void {
  if (delegationTextHasFormat(responses.text)) {
    throw new Error(
      "Live delegation must not set text.format on sessions.accept (use voiceV3CallerMeaningTextFormat only on responses.parse)",
    );
  }

  const serialized = JSON.stringify(responses);
  if (serialized.includes('"format"')) {
    throw new Error(
      "Live delegation accept payload must not serialize text.format (unsupported on sessions.accept)",
    );
  }
}

/** Log + validate accept delegation slice (no network). */
export function validateAndLogLiveAcceptDelegationPayload(
  responses: ResponsesDelegationConfig,
): void {
  assertLiveDelegationAcceptPayloadCompatible(responses);
  const transport = resolveVoiceV3IntakeTransport();
  const toolNames = (responses.tools ?? [])
    .map((t) => (t && typeof t === "object" && "name" in t ? String(t.name) : ""))
    .filter(Boolean);

  console.log("VOICE_V3_LIVE_ACCEPT_PAYLOAD_VALIDATED", {
    transport,
    tool_names: toolNames,
    tool_choice: responses.tool_choice ?? null,
    has_text_format: false,
    serialized_bytes: JSON.stringify(responses).length,
  });
}
