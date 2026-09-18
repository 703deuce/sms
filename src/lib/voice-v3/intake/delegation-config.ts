import { zodTextFormat } from "openai/helpers/zod";
import type { ResponsesDelegationConfig } from "openai/resources/live/live";
import {
  CALLER_MEANING_STRUCTURED_OUTPUT_NAME,
  callerMeaningZodSchema,
} from "./caller-meaning-schema";
import { voiceV3IntakePipelineEnabled } from "../state/call-runtime";

const VOICE_V3_ASTRA_MODEL = "gpt-6-astra";

/**
 * Live accept: delegated Responses backend (GPT-6 Astra).
 * Structured Outputs: `delegation.responses.text.format` via zodTextFormat
 * (runtime JSON Schema type `json_schema`, name `voice_v3_caller_meaning`).
 * SDK `ResponsesDelegationConfig.Text` only types `verbosity`; `format` is set per API docs.
 */
export function buildVoiceV3AstraDelegationResponses(
  astraInstructions: string,
): ResponsesDelegationConfig {
  const textBase = { verbosity: "low" as const };

  const text =
    voiceV3IntakePipelineEnabled()
      ? {
          ...textBase,
          format: zodTextFormat(callerMeaningZodSchema, CALLER_MEANING_STRUCTURED_OUTPUT_NAME),
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

export function voiceV3CallerMeaningTextFormat() {
  return zodTextFormat(callerMeaningZodSchema, CALLER_MEANING_STRUCTURED_OUTPUT_NAME);
}
