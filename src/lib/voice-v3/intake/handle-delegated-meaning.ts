import { getVoiceV3CallRuntime } from "../state/call-runtime";
import type { VoiceV3LiveRuntimeHooks } from "../live-runtime-hooks";
import { requestLiveSpeakContinuation } from "../live-response-trigger";
import { VoiceV3CallTrace } from "../telemetry/call-trace";
import { logVoiceV3Pipeline, summarizeAstraNestedEvent } from "../telemetry/pipeline-log";
import { EMIT_CALLER_MEANING_TOOL_NAME } from "./emit-caller-meaning-tool";
import { resolveVoiceV3IntakeTransport } from "./intake-transport";
import { extractCallerMeaningFromAstraResponseEvent } from "./parse-astra-meaning-response";
import {
  claimCallerMeaningFingerprint,
  claimDelegatedAstraResponse,
  clearDelegatedAstraResponseDedup,
} from "./delegated-response-dedup";
import { buildSemanticExtractionRecovery } from "../recovery/evaluate-recovery";
import { pushVoiceV3RecoveryToLive } from "../recovery/push-recovery-to-live";
import { applyExtractedCallerMeaning } from "./apply-extracted-meaning";
import { extractRawMeaningArgumentsFromNested } from "./extract-raw-meaning-arguments";
import {
  attemptSemanticExtractionRetry,
  clearSemanticExtractionRetryState,
} from "./semantic-extraction-retry";
import { clearCallerTurnBuffer } from "./caller-turn-buffer";

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
  nested: Record<string, unknown>;
  nestedType: string;
  send: (event: { type: string; [key: string]: unknown }) => void;
}): Promise<void> {
  const sessionId = input.liveSessionId;
  const priorArgumentsJson = extractRawMeaningArgumentsFromNested(input.nested);

  const retryEligible =
    input.nestedType === "response.output_item.done" ||
    input.nestedType === "response.function_call_arguments.done";

  if (retryEligible) {
    const retry = await attemptSemanticExtractionRetry({
      liveSessionId: sessionId,
      nested: input.nested,
      priorArgumentsJson,
      runtime: input.runtime,
      send: input.send,
    });
    if (retry.applied) {
      return;
    }
  }

  const semanticRecovery = buildSemanticExtractionRecovery(input.runtime.getSnapshot());
  pushVoiceV3RecoveryToLive({
    runtime: input.runtime,
    liveSessionId: sessionId,
    forced: semanticRecovery,
    hooks: buildLiveHooks(sessionId, input.send),
    speakReason: "semantic_extraction_failed",
  });
}

export function handleDelegatedAstraResponseEvent(input: {
  liveSessionId: string;
  nested: Record<string, unknown>;
  send: (event: { type: string; [key: string]: unknown }) => void;
}): void {
  const nestedType = String(input.nested.type || "");
  const sessionId = input.liveSessionId;

  if (nestedType === "response.created" || nestedType === "response.in_progress") {
    if (!meaningStartedSessions.has(sessionId)) {
      meaningStartedSessions.add(sessionId);
      const runtime = getVoiceV3CallRuntime(sessionId);
      console.log("ASTRA_MEANING_STARTED", {
        call_id: runtime?.getSnapshot().callId ?? null,
        live_session_id: sessionId,
        response_type: nestedType,
      });
    }
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

  const completionTypes = new Set([
    "response.function_call_arguments.done",
    "response.completed",
    "response.output_text.done",
    "response.output_item.done",
  ]);

  if (!completionTypes.has(nestedType)) {
    return;
  }

  const intakeTransport = resolveVoiceV3IntakeTransport();
  if (intakeTransport === "function_tool" && nestedType === "response.output_text.done") {
    return;
  }

  queueMicrotask(() => {
    void (async () => {
      const runtime = getVoiceV3CallRuntime(sessionId);
      if (!runtime) {
        meaningStartedSessions.delete(sessionId);
        return;
      }

      const snap = runtime.getSnapshot();
      const logCtx = {
        callId: snap.callId,
        liveSessionId: snap.liveSessionId,
        stateVersion: snap.runtime.version,
      };

      const extracted = extractCallerMeaningFromAstraResponseEvent(input.nested, runtime.config, logCtx);
      if (!extracted) {
        if (nestedType === "response.output_item.done") {
          const item = input.nested.item;
          if (item && typeof item === "object") {
            const row = item as Record<string, unknown>;
            if (row.type !== "function_call") {
              meaningStartedSessions.delete(sessionId);
              return;
            }
          }
        }

        if (
          intakeTransport === "function_tool" &&
          nestedType === "response.function_call_arguments.done"
        ) {
          const fnName = input.nested.name;
          if (
            fnName !== EMIT_CALLER_MEANING_TOOL_NAME &&
            fnName !== undefined &&
            fnName !== null &&
            fnName !== ""
          ) {
            meaningStartedSessions.delete(sessionId);
            return;
          }
        }

        if (
          intakeTransport === "function_tool" &&
          (nestedType === "response.completed" || nestedType === "response.output_text.done")
        ) {
          VoiceV3CallTrace.peek(sessionId)?.onMeaningSkipped();
          logVoiceV3Pipeline("meaning", "completion_skipped", {
            call_id: runtime.getSnapshot().callId,
            live_session_id: sessionId,
            reason: "function_tool_no_payload_on_completion_event",
            nested_type: nestedType,
          });
          meaningStartedSessions.delete(sessionId);
          return;
        }

        if (
          nestedType === "response.completed" ||
          nestedType === "response.output_item.done" ||
          nestedType === "response.function_call_arguments.done"
        ) {
          VoiceV3CallTrace.peek(sessionId)?.onMeaningFailed();
          logVoiceV3Pipeline("meaning", "extract_failed", {
            call_id: runtime.getSnapshot().callId,
            live_session_id: sessionId,
            reason: "schema_validation_or_empty",
            nested_type: nestedType,
            ...summarizeAstraNestedEvent(input.nested),
          });
          console.log("SEMANTIC_EXTRACTION_FAILED", {
            call_id: runtime.getSnapshot().callId,
            live_session_id: sessionId,
            nested_type: nestedType,
          });
          await handleSemanticExtractionFailure({
            runtime,
            liveSessionId: sessionId,
            nested: input.nested,
            nestedType,
            send: input.send,
          });
        }
        meaningStartedSessions.delete(sessionId);
        return;
      }

      if (!claimDelegatedAstraResponse(sessionId, input.nested)) {
        meaningStartedSessions.delete(sessionId);
        return;
      }

      const { meaning, transport } = extracted;
      if (!claimCallerMeaningFingerprint(sessionId, JSON.stringify(meaning))) {
        meaningStartedSessions.delete(sessionId);
        return;
      }

      console.log("ASTRA_MEANING_RECEIVED", {
        call_id: snap.callId,
        live_session_id: sessionId,
        transport,
        state_version: snap.runtime.version,
      });

      try {
        await applyExtractedCallerMeaning({
          runtime,
          liveSessionId: sessionId,
          meaning,
          transport,
          send: input.send,
          source: "delegation",
        });
      } catch (err) {
        console.error("VOICE_V3_POST_MEANING_PIPELINE_ERROR", {
          live_session_id: sessionId,
          err,
        });
      }

      meaningStartedSessions.delete(sessionId);
    })();
  });
}

export function clearDelegatedMeaningSessionState(liveSessionId: string): void {
  meaningStartedSessions.delete(liveSessionId);
  clearDelegatedAstraResponseDedup(liveSessionId);
  clearSemanticExtractionRetryState(liveSessionId);
  clearCallerTurnBuffer(liveSessionId);
}
