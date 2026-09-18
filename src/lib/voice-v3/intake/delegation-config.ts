import { zodTextFormat } from "openai/helpers/zod";
import type { ResponsesDelegationConfig } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { resolveVoiceV3AgentConfig, voiceV3IntakePipelineEnabled } from "../state/call-runtime";
import {
  buildCallerMeaningZodSchema,
  CALLER_MEANING_STRUCTURED_OUTPUT_NAME,
} from "./caller-meaning-schema";

const VOICE_V3_ASTRA_MODEL = "gpt-6-astra";

/**
 * Live `sessions.accept` delegation config (PSTN/SIP).
 *
 * OpenAI Live delegation currently accepts `text.verbosity` only — not
 * `text.format` (Structured Outputs). Sending `format` causes HTTP 400
 * `Unknown parameter: session.delegation.responses.text.format` and the call
 * stays silent because accept never completes.
 *
 * Strict JSON schema is applied on `responses.parse` integration tests via
 * `voiceV3CallerMeaningTextFormat`. Live delegated output is still parsed with
 * the same Zod schema in `decodeDelegatedCallerMeaning`.
 */
export function buildVoiceV3AstraDelegationResponses(
  astraInstructions: string,
  agentConfig: VoiceV3AgentConfig = resolveVoiceV3AgentConfig(),
): ResponsesDelegationConfig {
  const intakeEnabled = voiceV3IntakePipelineEnabled();

  return {
    model: VOICE_V3_ASTRA_MODEL,
    instructions: astraInstructions,
    reasoning: {
      effort: "low",
    },
    text: {
      verbosity: "low",
    },
    parallel_tool_calls: false,
    tool_choice: "auto",
    max_output_tokens: intakeEnabled ? 768 : 200,
    tools: [],
  };
}

/** Structured Outputs for standalone Responses API (`responses.parse` tests). */
export function voiceV3CallerMeaningTextFormat(agentConfig: VoiceV3AgentConfig) {
  return zodTextFormat(
    buildCallerMeaningZodSchema(agentConfig),
    CALLER_MEANING_STRUCTURED_OUTPUT_NAME,
  );
}

/** Guardrail test: Live accept payload must not include unsupported keys. */
export function assertLiveDelegationAcceptPayloadCompatible(
  responses: ResponsesDelegationConfig,
): void {
  const text = responses.text as { format?: unknown; verbosity?: string } | null | undefined;
  if (text && "format" in text && text.format !== undefined) {
    throw new Error(
      "Live delegation must not set text.format on sessions.accept (use voiceV3CallerMeaningTextFormat only on responses.parse)",
    );
  }
}
