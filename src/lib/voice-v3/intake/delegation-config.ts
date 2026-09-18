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
 * Live accept: delegated Responses backend (GPT-6 Astra).
 * Structured Outputs: `delegation.responses.text.format` via zodTextFormat
 * (runtime JSON Schema type `json_schema`, name `voice_v3_caller_meaning`).
 * Field keys are a per-AgentConfig enum in the generated JSON Schema.
 */
export function buildVoiceV3AstraDelegationResponses(
  astraInstructions: string,
  agentConfig: VoiceV3AgentConfig = resolveVoiceV3AgentConfig(),
): ResponsesDelegationConfig {
  const textBase = { verbosity: "low" as const };

  const text =
    voiceV3IntakePipelineEnabled()
      ? {
          ...textBase,
          format: zodTextFormat(
            buildCallerMeaningZodSchema(agentConfig),
            CALLER_MEANING_STRUCTURED_OUTPUT_NAME,
          ),
        }
      : textBase;

  return {
    model: VOICE_V3_ASTRA_MODEL,
    instructions: astraInstructions,
    reasoning: {
      effort: "low",
    },
    text: text as ResponsesDelegationConfig["text"],
    parallel_tool_calls: false,
    tool_choice: "auto",
    max_output_tokens: voiceV3IntakePipelineEnabled() ? 768 : 200,
    tools: [],
  };
}

export function voiceV3CallerMeaningTextFormat(agentConfig: VoiceV3AgentConfig) {
  return zodTextFormat(
    buildCallerMeaningZodSchema(agentConfig),
    CALLER_MEANING_STRUCTURED_OUTPUT_NAME,
  );
}
