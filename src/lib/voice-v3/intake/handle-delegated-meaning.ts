import { getVoiceV3CallRuntime } from "../state/call-runtime";
import type { VoiceV3LiveRuntimeHooks } from "../live-runtime-hooks";
import { requestLiveSpeakContinuation } from "../live-response-trigger";
import { VoiceV3CallTrace } from "../telemetry/call-trace";
import { logVoiceV3Pipeline, summarizeAstraNestedEvent } from "../telemetry/pipeline-log";
import { EMIT_CALLER_MEANING_TOOL_NAME } from "./emit-caller-meaning-tool";
import { resolveVoiceV3IntakeTransport } from "./intake-transport";
import {
  claimCallerMeaningFingerprint,
  claimDelegatedAstraResponse,
  clearDelegatedAstraResponseDedup,
} from "./delegated-response-dedup";
import { buildSemanticExtractionRecovery } from "../recovery/evaluate-recovery";
import { pushVoiceV3RecoveryToLive } from "../recovery/push-recovery-to-live";
import { applyExtractedCallerMeaning } from "./apply-extracted-meaning";
import {
  attemptSemanticExtractionRetry,
  clearSemanticExtractionRetryState,
} from "./semantic-extraction-retry";
import { clearCallerTurnBuffer } from "./caller-turn-buffer";
import { clearGreetingTurnState } from "../greeting/greeting-turn";
import { clearVoiceV3LiveResponseCoordinator } from "../delegation/live-response-coordinator";
import { extractCompletedFunctionCallFromNested } from "../delegation/extract-completed-function-call";
import { getVoiceV3LiveResponseCoordinator } from "../delegation/live-response-coordinator";
import { decodeCallerMeaningAttempt } from "./decode-delegated-caller-meaning";
import {
  shouldDeferUnstableGreetingSemanticTurn,
} from "../greeting/greeting-turn";
import {
  drainQueuedSemanticTurns,
  markSemanticInterpretationEnded,
  markSemanticInterpretationStarted,
} from "../conversation/semantic-turn-watchdog";
import { clearCallerTurnManager } from "../conversation/caller-turn-manager";
import { clearSemanticTurnWatchdog } from "../conversation/semantic-turn-watchdog";
import { clearLiveSpeakSync } from "../agent/live-speak-sync";

const meaningStartedSessions = new Set<string>();

function buildLiveHooks(
  sessionId: string,
  send: (event: { type: string; [key: string]: unknown }) => void,
): VoiceV3LiveRuntimeHooks {
  return {
    onLiveContext: (event) => send(event),
    requestSpeak: (reason) =>
      requestLiveSpeakContinuation({
        send,
        liveSessionId: sessionId,
        reason,
      }),
  };
}

async function handleSemanticExtractionFailure(input: {
  runtime: NonNullable<ReturnType<typeof getVoiceV3CallRuntime>>;
  liveSessionId: string;
  send: (event: { type: string; [key: string]: unknown }) => void;
  deferRecoverySpeak: boolean;
}): Promise<void> {
  const sessionId = input.liveSessionId;

  const semanticRecovery = buildSemanticExtractionRecovery(input.runtime.getSnapshot());
  pushVoiceV3RecoveryToLive({
    runtime: input.runtime,
    liveSessionId: sessionId,
    forced: semanticRecovery,
    hooks: buildLiveHooks(sessionId, input.send),
    skipLiveSpeak: input.deferRecoverySpeak,
    speakReason: "semantic_extraction_failed",
  });

  if (input.deferRecoverySpeak) {
    console.log("SEMANTIC_RECOVERY_DEFERRED_GREETING_BOUNDARY", {
      call_id: input.runtime.getSnapshot().callId,
      live_session_id: sessionId,
    });
  }
}

async function completeEmitCallerMeaningFunctionCall(input: {
  runtime: NonNullable<ReturnType<typeof getVoiceV3CallRuntime>>;
  liveSessionId: string;
  nested: Record<string, unknown>;
  send: (event: { type: string; [key: string]: unknown }) => void;
  delegationId?: string | null;
}): Promise<void> {
  const sessionId = input.liveSessionId;
  const completed = extractCompletedFunctionCallFromNested(input.nested, input.delegationId);
  if (!completed) return;

  const coordinator = getVoiceV3LiveResponseCoordinator(sessionId, input.send);
  const registered = coordinator.registerPendingFunctionCall(completed);
  if (!registered && completed.callId) {
    logVoiceV3Pipeline("meaning", "duplicate_function_call_ignored", {
      live_session_id: sessionId,
      call_id: completed.callId,
    });
    return;
  }

  const snap = input.runtime.getSnapshot();
  const logCtx = {
    callId: snap.callId,
    liveSessionId: snap.liveSessionId,
    stateVersion: snap.runtime.version,
  };

  const decoded = decodeCallerMeaningAttempt(
    completed.argumentsJson,
    input.runtime.config,
    logCtx,
  );

  const deferRecoverySpeak = shouldDeferUnstableGreetingSemanticTurn(sessionId);

  coordinator.submitFunctionCallOutput(completed.callId, {
    accepted: decoded.ok,
    reason: decoded.ok ? undefined : decoded.reason,
  });

  if (decoded.ok) {
    if (!claimDelegatedAstraResponse(sessionId, input.nested)) {
      return;
    }
    const { meaning } = decoded;
    if (!claimCallerMeaningFingerprint(sessionId, JSON.stringify(meaning))) {
      return;
    }

    VoiceV3CallTrace.peek(sessionId)?.onMeaningReceived();
    console.log("ASTRA_MEANING_RECEIVED", {
      call_id: snap.callId,
      live_session_id: sessionId,
      transport: "function_tool",
      state_version: snap.runtime.version,
    });

    try {
      await applyExtractedCallerMeaning({
        runtime: input.runtime,
        liveSessionId: sessionId,
        meaning,
        transport: "function_tool",
        send: input.send,
        source: "delegation",
      });
    } catch (err) {
      console.error("VOICE_V3_POST_MEANING_PIPELINE_ERROR", {
        live_session_id: sessionId,
        err,
      });
    } finally {
      markSemanticInterpretationEnded(sessionId);
    }
    return;
  }

  VoiceV3CallTrace.peek(sessionId)?.onMeaningFailed();
  logVoiceV3Pipeline("meaning", "extract_failed", {
    call_id: snap.callId,
    live_session_id: sessionId,
    reason: decoded.reason,
    nested_type: "response.output_item.done",
    ...summarizeAstraNestedEvent(input.nested),
  });
  console.log("SEMANTIC_EXTRACTION_FAILED", {
    call_id: snap.callId,
    live_session_id: sessionId,
    nested_type: "response.output_item.done",
    reason: decoded.reason,
  });

  const retry = await attemptSemanticExtractionRetry({
    liveSessionId: sessionId,
    nested: input.nested,
    priorArgumentsJson: completed.argumentsJson || null,
    runtime: input.runtime,
    send: input.send,
  });
  if (retry.applied) {
    return;
  }

  await handleSemanticExtractionFailure({
    runtime: input.runtime,
    liveSessionId: sessionId,
    send: input.send,
    deferRecoverySpeak,
  });
}

export function handleDelegatedAstraResponseEvent(input: {
  liveSessionId: string;
  nested: Record<string, unknown>;
  send: (event: { type: string; [key: string]: unknown }) => void;
  delegationId?: string | null;
}): void {
  const nestedType = String(input.nested.type || "");
  const sessionId = input.liveSessionId;

  getVoiceV3LiveResponseCoordinator(sessionId, input.send).onDelegatedNestedResponseEvent(
    input.delegationId,
    input.nested,
  );

  if (nestedType === "response.completed") {
    drainQueuedSemanticTurns({ liveSessionId: sessionId, send: input.send });
  }

  if (nestedType === "response.created" || nestedType === "response.in_progress") {
    markSemanticInterpretationStarted(sessionId);
    if (!meaningStartedSessions.has(sessionId)) {
      meaningStartedSessions.add(sessionId);
      const runtime = getVoiceV3CallRuntime(sessionId);
      console.log("ASTRA_MEANING_STARTED", {
        call_id: runtime?.getSnapshot().callId ?? null,
        live_session_id: sessionId,
        response_type: nestedType,
      });
    }
    return;
  }

  if (nestedType === "response.failed") {
    const runtime = getVoiceV3CallRuntime(sessionId);
    VoiceV3CallTrace.peek(sessionId)?.onMeaningFailed();
    logVoiceV3Pipeline("meaning", "astra.response.failed", {
      call_id: runtime?.getSnapshot().callId ?? null,
      live_session_id: sessionId,
      nested: input.nested,
    });
    console.log("ASTRA_MEANING_FAILED", {
      call_id: runtime?.getSnapshot().callId ?? null,
      live_session_id: sessionId,
      reason: "response.failed",
    });
    meaningStartedSessions.delete(sessionId);
    return;
  }

  const intakeTransport = resolveVoiceV3IntakeTransport();

  if (intakeTransport === "function_tool" && nestedType === "response.function_call_arguments.done") {
    logVoiceV3Pipeline("meaning", "arguments_stream_done", {
      live_session_id: sessionId,
      name: input.nested.name,
      note: "non_authoritative_wait_for_output_item_done",
    });
    return;
  }

  if (nestedType === "response.output_item.done") {
    const item = input.nested.item;
    if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      if (row.type === "function_call") {
        const name = row.name;
        if (
          name === EMIT_CALLER_MEANING_TOOL_NAME ||
          name === undefined ||
          name === null ||
          name === ""
        ) {
          queueMicrotask(() => {
            void (async () => {
              const runtime = getVoiceV3CallRuntime(sessionId);
              if (!runtime) {
                meaningStartedSessions.delete(sessionId);
                return;
              }
              await completeEmitCallerMeaningFunctionCall({
                runtime,
                liveSessionId: sessionId,
                nested: input.nested,
                send: input.send,
                delegationId: input.delegationId,
              });
              meaningStartedSessions.delete(sessionId);
            })();
          });
          return;
        }
      }
    }
    return;
  }

  if (
    intakeTransport === "function_tool" &&
    (nestedType === "response.completed" || nestedType === "response.output_text.done")
  ) {
    VoiceV3CallTrace.peek(sessionId)?.onMeaningSkipped();
    logVoiceV3Pipeline("meaning", "completion_skipped", {
      live_session_id: sessionId,
      reason: "function_tool_no_payload_on_completion_event",
      nested_type: nestedType,
    });
    meaningStartedSessions.delete(sessionId);
  }
}

export function clearDelegatedMeaningSessionState(liveSessionId: string): void {
  meaningStartedSessions.delete(liveSessionId);
  clearDelegatedAstraResponseDedup(liveSessionId);
  clearSemanticExtractionRetryState(liveSessionId);
  clearCallerTurnBuffer(liveSessionId);
  clearCallerTurnManager(liveSessionId);
  clearSemanticTurnWatchdog(liveSessionId);
  clearLiveSpeakSync(liveSessionId);
  clearGreetingTurnState(liveSessionId);
  clearVoiceV3LiveResponseCoordinator(liveSessionId);
}
