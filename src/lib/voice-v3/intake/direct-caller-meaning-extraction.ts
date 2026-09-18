import { getVoiceV3BasicOpenAiClient } from "@/lib/voice-v3-basic/openai-client";
import { buildVoiceV3Prompts } from "../prompts/build-voice-v3-prompts";
import type { VoiceV3CallRuntime } from "../state/call-runtime";
import { buildCallerInterpretationContext, formatCallerInterpretationContextJson } from "./caller-meaning";
import { decodeCallerMeaningFromFunctionArguments } from "./decode-delegated-caller-meaning";
import { buildEmitCallerMeaningLiveFunctionTool, EMIT_CALLER_MEANING_TOOL_NAME } from "./emit-caller-meaning-tool";
import type { CallerMeaning } from "./caller-meaning-schema";

let extractionRunnerOverride: ((input: DirectCallerMeaningExtractionInput) => Promise<CallerMeaning | null>) | null =
  null;

export function setDirectCallerMeaningExtractionRunnerForTests(
  runner: ((input: DirectCallerMeaningExtractionInput) => Promise<CallerMeaning | null>) | null,
): void {
  extractionRunnerOverride = runner;
}

export type DirectCallerMeaningExtractionInput = {
  runtime: VoiceV3CallRuntime;
  liveSessionId: string;
  callerUtterance: string;
  priorArgumentsJson?: string | null;
  attemptId: string;
};

/**
 * Application-side semantic path (Responses API) when Live delegation does not run.
 * Same tool boundary as delegated emit_caller_meaning.
 */
export async function runDirectCallerMeaningExtraction(
  input: DirectCallerMeaningExtractionInput,
): Promise<CallerMeaning | null> {
  const utterance = input.callerUtterance.trim();
  if (!utterance) {
    return null;
  }
  if (extractionRunnerOverride) {
    return extractionRunnerOverride(input);
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return null;
  }

  const client = getVoiceV3BasicOpenAiClient();
  const config = input.runtime.config;
  const ctx = input.runtime.getSnapshot();
  const prompts = buildVoiceV3Prompts({ agentConfig: config });
  const interpretation = formatCallerInterpretationContextJson(
    buildCallerInterpretationContext(config, ctx),
  );

  const userLines = [
    "Interpret the caller's latest committed turn for emit_caller_meaning.",
    `Caller utterance: ${utterance}`,
    `Authoritative interpretation context JSON:\n${interpretation}`,
  ];
  if (input.priorArgumentsJson) {
    userLines.push(
      `Prior tool output was malformed or empty (diagnosis only):\n${input.priorArgumentsJson.slice(0, 2000)}`,
    );
  }

  const tool = buildEmitCallerMeaningLiveFunctionTool(config);
  const response = await client.responses.create({
    model: "gpt-6-astra",
    instructions: prompts.astraInstructions,
    input: [{ role: "user", content: userLines.join("\n\n") }],
    tools: [
      {
        type: "function",
        name: tool.name,
        description: tool.description ?? undefined,
        parameters: tool.parameters ?? {},
        strict: tool.strict ?? true,
      },
    ],
    tool_choice: { type: "function", name: EMIT_CALLER_MEANING_TOOL_NAME },
    parallel_tool_calls: false,
    max_output_tokens: 768,
  });

  const output = response.output ?? [];
  const fnCall = output.find(
    (item) => item.type === "function_call" && item.name === EMIT_CALLER_MEANING_TOOL_NAME,
  );
  if (!fnCall || fnCall.type !== "function_call" || typeof fnCall.arguments !== "string") {
    return null;
  }

  return decodeCallerMeaningFromFunctionArguments(fnCall.arguments, config, {
    callId: ctx.callId,
    liveSessionId: input.liveSessionId,
    stateVersion: ctx.runtime.version,
  });
}
