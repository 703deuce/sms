import { zodTextFormat } from "openai/helpers/zod";
import type { ResponsesDelegationConfig } from "openai/resources/live/live";
import { voiceV3IntakePipelineEnabled } from "../call-context/resolve-business-config";
import { voiceV3IntakeExtractionSchema } from "./extraction-schema";

const VOICE_V3_ASTRA_MODEL = "gpt-6-astra";

export function buildVoiceV3AstraDelegationResponses(
  astraInstructions: string,
): ResponsesDelegationConfig {
  const textBase = { verbosity: "low" as const };

  const text =
    voiceV3IntakePipelineEnabled()
      ? {
          ...textBase,
          format: zodTextFormat(voiceV3IntakeExtractionSchema, "voice_v3_intake_extraction"),
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
    max_output_tokens: voiceV3IntakePipelineEnabled() ? 512 : 200,
    tools: [],
  };
}
