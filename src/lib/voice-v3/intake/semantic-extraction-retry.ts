import type { VoiceV3CallRuntime } from "../state/call-runtime";
import {
  claimCallerMeaningFingerprint,
  extractDelegatedAstraResponseId,
  markDelegatedAstraResponseProcessed,
} from "./delegated-response-dedup";
import { getCallerEvidenceForSemanticRetry } from "../conversation/caller-turn-manager";
import { applyExtractedCallerMeaning } from "./apply-extracted-meaning";
import type { CallerMeaning } from "./caller-meaning-schema";
import { runDirectCallerMeaningExtraction } from "./direct-caller-meaning-extraction";

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
  if (!input.callerUtterance.trim()) {
    return null;
  }
  return runDirectCallerMeaningExtraction({
    runtime: input.runtime,
    liveSessionId: input.liveSessionId,
    callerUtterance: input.callerUtterance,
    priorArgumentsJson: input.priorArgumentsJson,
    attemptId: input.attemptId,
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

  const callerUtterance = getCallerEvidenceForSemanticRetry(input.liveSessionId);
  if (!callerUtterance.trim()) {
    console.log("SEMANTIC_EXTRACTION_RETRY_SKIPPED", {
      call_id: input.runtime.getSnapshot().callId,
      live_session_id: input.liveSessionId,
      reason: "empty_caller_evidence",
      response_id: responseId,
    });
    return { applied: false, attemptId: null };
  }
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
