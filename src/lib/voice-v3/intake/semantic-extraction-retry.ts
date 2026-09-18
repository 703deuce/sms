import type OpenAI from "openai";
import { getVoiceV3BasicOpenAiClient } from "@/lib/voice-v3-basic/openai-client";
import { buildVoiceV3Prompts } from "../prompts/build-voice-v3-prompts";
import type { VoiceV3CallRuntime } from "../state/call-runtime";
import { buildCallerInterpretationContext, formatCallerInterpretationContextJson } from "./caller-meaning";
import { decodeCallerMeaningFromFunctionArguments } from "./decode-delegated-caller-meaning";
import { buildEmitCallerMeaningLiveFunctionTool, EMIT_CALLER_MEANING_TOOL_NAME } from "./emit-caller-meaning-tool";
import {
  claimCallerMeaningFingerprint,
  extractDelegatedAstraResponseId,
  markDelegatedAstraResponseProcessed,
} from "./delegated-response-dedup";
import { getLastCommittedCallerUtterance } from "./caller-turn-buffer";
import { applyExtractedCallerMeaning } from "./apply-extracted-meaning";
import type { CallerMeaning } from "./caller-meaning-schema";

const MAX_SEMANTIC_RETRIES_PER_RESPONSE = 1;

const retryAttemptsBySession = new Map<string, Set<string>>();
const appliedRetryBySession = new Map<string, Set<string>>();

export type SemanticExtractionRetryRunner = (input: {
  runtime: VoiceV3CallRuntime;
  liveSessionId: string;
  callerUtterance: string;
  priorArgumentsJson: string | null;
  attemptId: string;
}) => Promise<CallerMeaning | null>;

let retryRunnerOverride: SemanticExtractionRetryRunner | null = null;

export function setSemanticExtractionRetryRunnerForTests(
  runner: SemanticExtractionRetryRunner | null,
): void {
  retryRunnerOverride = runner;
}

export function clearSemanticExtractionRetryState(liveSessionId: string): void {
  retryAttemptsBySession.delete(liveSessionId.trim());
  appliedRetryBySession.delete(liveSessionId.trim());
}

function claimRetryAttempt(liveSessionId: string, responseId: string): boolean {
  const sessionId = liveSessionId.trim();
  const set = retryAttemptsBySession.get(sessionId) ?? new Set<string>();
  if (set.has(responseId)) return false;
  if (set.size >= 32) return false;
  set.add(responseId);
  retryAttemptsBySession.set(sessionId, set);
  return true;
}

function claimRetryApplication(liveSessionId: string, attemptId: string): boolean {
  const sessionId = liveSessionId.trim();
  const set = appliedRetryBySession.get(sessionId) ?? new Set<string>();
  if (set.has(attemptId)) return false;
  set.add(attemptId);
  appliedRetryBySession.set(sessionId, set);
  return true;
}

async function defaultSemanticExtractionRetryRunner(input: {
  runtime: VoiceV3CallRuntime;
  liveSessionId: string;
  callerUtterance: string;
  priorArgumentsJson: string | null;
  attemptId: string;
}): Promise<CallerMeaning | null> {
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
    "Re-interpret the caller's last turn for emit_caller_meaning.",
    `Caller utterance: ${input.callerUtterance || "(not available — use interpretation context only)"}`,
    `Authoritative interpretation context JSON:\n${interpretation}`,
  ];
  if (input.priorArgumentsJson) {
    userLines.push(
      `Prior delegated tool output was malformed or empty. Do not repeat the mistake. Prior raw arguments (for diagnosis only):\n${input.priorArgumentsJson.slice(0, 2000)}`,
    );
  }

  const tool = buildEmitCallerMeaningLiveFunctionTool(config);
  const response = await client.responses.create({
    model: "gpt-6-astra",
    instructions: prompts.astraInstructions,
    input: [
      {
        role: "user",
        content: userLines.join("\n\n"),
      },
    ],
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

export async function attemptSemanticExtractionRetry(input: {
  liveSessionId: string;
  nested: Record<string, unknown>;
  priorArgumentsJson: string | null;
  runtime: VoiceV3CallRuntime;
  send: (event: { type: string; [key: string]: unknown }) => void;
}): Promise<{ applied: boolean; attemptId: string | null }> {
  const responseId = extractDelegatedAstraResponseId(input.nested);
  if (!responseId) {
    return { applied: false, attemptId: null };
  }

  if (!claimRetryAttempt(input.liveSessionId, responseId)) {
    return { applied: false, attemptId: null };
  }

  const attemptId = `sem_retry_${responseId}`;
  if (!claimRetryApplication(input.liveSessionId, attemptId)) {
    return { applied: false, attemptId: null };
  }

  const callerUtterance = getLastCommittedCallerUtterance(input.liveSessionId);
  console.log("SEMANTIC_EXTRACTION_RETRY_STARTED", {
    call_id: input.runtime.getSnapshot().callId,
    live_session_id: input.liveSessionId,
    attempt_id: attemptId,
    response_id: responseId,
    caller_utterance_chars: callerUtterance.length,
    prior_arguments_bytes: input.priorArgumentsJson?.length ?? 0,
  });

  const runner = retryRunnerOverride ?? defaultSemanticExtractionRetryRunner;
  let meaning: CallerMeaning | null = null;
  try {
    meaning = await runner({
      runtime: input.runtime,
      liveSessionId: input.liveSessionId,
      callerUtterance,
      priorArgumentsJson: input.priorArgumentsJson,
      attemptId,
    });
  } catch (err) {
    console.log("SEMANTIC_EXTRACTION_RETRY_FAILED", {
      call_id: input.runtime.getSnapshot().callId,
      live_session_id: input.liveSessionId,
      attempt_id: attemptId,
      reason: "runner_threw",
      err,
    });
    return { applied: false, attemptId };
  }

  if (!meaning) {
    console.log("SEMANTIC_EXTRACTION_RETRY_FAILED", {
      call_id: input.runtime.getSnapshot().callId,
      live_session_id: input.liveSessionId,
      attempt_id: attemptId,
      reason: "empty_or_invalid_meaning",
    });
    return { applied: false, attemptId };
  }

  if (!claimCallerMeaningFingerprint(input.liveSessionId, JSON.stringify(meaning))) {
    console.log("SEMANTIC_EXTRACTION_RETRY_FAILED", {
      call_id: input.runtime.getSnapshot().callId,
      live_session_id: input.liveSessionId,
      attempt_id: attemptId,
      reason: "duplicate_fingerprint",
    });
    return { applied: false, attemptId };
  }

  console.log("SEMANTIC_EXTRACTION_RETRY_SUCCEEDED", {
    call_id: input.runtime.getSnapshot().callId,
    live_session_id: input.liveSessionId,
    attempt_id: attemptId,
    active_goal: meaning.active_goal,
    captured_field_keys: meaning.captured_fields.map((r) => r.key),
  });

  markDelegatedAstraResponseProcessed(input.liveSessionId, responseId);

  await applyExtractedCallerMeaning({
    runtime: input.runtime,
    liveSessionId: input.liveSessionId,
    meaning,
    transport: "function_tool",
    send: input.send,
    source: "semantic_retry",
  });

  return { applied: true, attemptId };
}
