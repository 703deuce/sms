import { dispatchFindAvailabilityIfRequired } from "../calendar/find-dispatch";
import { dispatchBookingIfRequired } from "../calendar/book-dispatch";
import { dispatchAppointmentManagementIfRequired } from "../calendar/appointment-management-dispatch";
import { buildLiveSelectedSlotSessionAppend } from "../calendar/live-selected-slot-context";
import {
  buildSessionThinkingAppendForRuntime,
  getVoiceV3CallRuntime,
} from "../state/call-runtime";
import { evaluateVoiceV3Rules } from "../state/call-rules";
import type { VoiceV3LiveRuntimeHooks } from "../live-runtime-hooks";
import { requestLiveSpeakContinuation } from "../live-response-trigger";
import { VoiceV3CallTrace } from "../telemetry/call-trace";
import { logVoiceV3Pipeline, summarizeAstraNestedEvent } from "../telemetry/pipeline-log";
import { validateCallerMeaningFromRaw } from "./decode-delegated-caller-meaning";
import { EMIT_CALLER_MEANING_TOOL_NAME } from "./emit-caller-meaning-tool";
import { resolveVoiceV3IntakeTransport } from "./intake-transport";
import { extractCallerMeaningFromAstraResponseEvent } from "./parse-astra-meaning-response";
import {
  claimCallerMeaningFingerprint,
  claimDelegatedAstraResponse,
  clearDelegatedAstraResponseDedup,
} from "./delegated-response-dedup";
import type { SelectedAvailabilitySlot } from "../calendar/selected-slot";
import { buildSemanticExtractionRecovery } from "../recovery/evaluate-recovery";
import { pushVoiceV3RecoveryToLive } from "../recovery/push-recovery-to-live";

const meaningStartedSessions = new Set<string>();

function slotSelectionChanged(
  before: SelectedAvailabilitySlot | null,
  after: SelectedAvailabilitySlot | null,
): boolean {
  if (!after) return false;
  if (!before) return true;
  return before.slotId !== after.slotId || before.offerSetId !== after.offerSetId;
}

async function runPostMeaningCalendarPipeline(input: {
  runtime: NonNullable<ReturnType<typeof getVoiceV3CallRuntime>>;
  liveHooks: VoiceV3LiveRuntimeHooks;
  send: (event: { type: string; [key: string]: unknown }) => void;
  liveSessionId: string;
  slotChanged: boolean;
  spokeContinuation: { value: boolean };
}): Promise<void> {
  const snapBefore = input.runtime.getSnapshot();
  const rulesBefore = evaluateVoiceV3Rules(snapBefore, input.runtime.config);
  logVoiceV3Pipeline("calendar", "post_meaning_pipeline_start", {
    call_id: snapBefore.callId,
    live_session_id: input.liveSessionId,
    required_action: rulesBefore.requiredAction,
    may_find_availability: rulesBefore.mayFindAvailability,
    booking_ready: rulesBefore.bookingReady,
  });

  await dispatchFindAvailabilityIfRequired(input.runtime, input.liveHooks);
  await dispatchBookingIfRequired(input.runtime, input.liveHooks);
  await dispatchAppointmentManagementIfRequired(input.runtime, input.liveHooks);

  if (input.spokeContinuation.value) return;

  const snap = input.runtime.getSnapshot();
  const rules = evaluateVoiceV3Rules(snap, input.runtime.config);

  if (input.slotChanged && snap.selection.selected) {
    requestLiveSpeakContinuation({
      send: input.send,
      liveSessionId: input.liveSessionId,
      reason: "slot_selected",
    });
    input.spokeContinuation.value = true;
    return;
  }

  if (rules.schedulingRequiresClarification && rules.schedulingClarificationPrompt) {
    requestLiveSpeakContinuation({
      send: input.send,
      liveSessionId: input.liveSessionId,
      reason: "scheduling_clarification",
    });
    input.spokeContinuation.value = true;
  }
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
          console.log("ASTRA_MEANING_COMPLETION_SKIPPED", {
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
          console.log("ASTRA_MEANING_FAILED", {
            call_id: runtime.getSnapshot().callId,
            live_session_id: sessionId,
            reason: "schema_validation_or_empty",
            nested_type: nestedType,
          });
          console.log("SEMANTIC_EXTRACTION_FAILED", {
            call_id: runtime.getSnapshot().callId,
            live_session_id: sessionId,
            nested_type: nestedType,
          });
          const semanticRecovery = buildSemanticExtractionRecovery(runtime.getSnapshot());
          pushVoiceV3RecoveryToLive({
            runtime,
            liveSessionId: sessionId,
            forced: semanticRecovery,
            hooks: {
              onLiveContext: (event) => input.send(event),
              requestSpeak: (reason) =>
                requestLiveSpeakContinuation({
                  send: input.send,
                  liveSessionId: sessionId,
                  reason,
                }),
            },
            speakReason: "semantic_extraction_failed",
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

      VoiceV3CallTrace.peek(sessionId)?.onMeaningReceived();
      logVoiceV3Pipeline("meaning", "received", {
        call_id: snap.callId,
        live_session_id: sessionId,
        transport,
        state_version: snap.runtime.version,
        active_goal: meaning.active_goal,
        captured_field_keys: meaning.captured_fields.map((r) => r.key),
        scheduling_date_relation: meaning.scheduling.date_relation,
        slot_selection_type: meaning.slot_selection.selection_type,
      });

      console.log("ASTRA_MEANING_RECEIVED", {
        call_id: snap.callId,
        live_session_id: sessionId,
        transport,
        state_version: snap.runtime.version,
      });

      const revalidate = validateCallerMeaningFromRaw(meaning, runtime.config, logCtx);
      if (!revalidate.ok) {
        console.log("ASTRA_MEANING_SCHEMA_INVALID", {
          call_id: snap.callId,
          live_session_id: sessionId,
          reason: revalidate.reason,
          state_version: snap.runtime.version,
        });
        meaningStartedSessions.delete(sessionId);
        return;
      }

      console.log("ASTRA_MEANING_SCHEMA_VALID", {
        call_id: snap.callId,
        live_session_id: sessionId,
        transport,
        state_version: snap.runtime.version,
      });

      const startedAt = Date.now();
      const beforeSelected = runtime.getSnapshot().selection.selected;
      runtime.applyEvent({
        type: "CALLER_MEANING_APPLIED",
        meaning: revalidate.meaning,
        astraLatencyMs: 0,
      });
      const afterSnap = runtime.getSnapshot();
      const afterSelected = afterSnap.selection.selected;
      const slotChanged = slotSelectionChanged(beforeSelected, afterSelected);

      if (slotChanged && afterSelected) {
        input.send(buildLiveSelectedSlotSessionAppend(afterSelected));
        console.log("LIVE_SELECTED_SLOT_CONTEXT_SENT", {
          call_id: afterSnap.callId,
          live_session_id: sessionId,
          scheduling_generation: afterSnap.scheduling.generation,
          offer_set_id: afterSelected.offerSetId,
          slot_id: afterSelected.slotId,
        });
      }

      console.log("ASTRA_MEANING_COMPLETED", {
        call_id: runtime.getSnapshot().callId,
        live_session_id: sessionId,
        state_version: runtime.getSnapshot().runtime.version,
        astra_latency_ms: Date.now() - startedAt,
        transport,
      });

      input.send(buildSessionThinkingAppendForRuntime(runtime));

      const spokeContinuation = { value: false };
      const liveHooks: VoiceV3LiveRuntimeHooks = {
        onLiveContext: (event) => input.send(event),
        requestSpeak: (reason) => {
          spokeContinuation.value = true;
          requestLiveSpeakContinuation({
            send: input.send,
            liveSessionId: sessionId,
            reason,
          });
        },
      };

      try {
        await runPostMeaningCalendarPipeline({
          runtime,
          liveHooks,
          send: input.send,
          liveSessionId: sessionId,
          slotChanged,
          spokeContinuation,
        });
        pushVoiceV3RecoveryToLive({
          runtime,
          liveSessionId: sessionId,
          hooks: liveHooks,
          speakReason: "workflow_recovery",
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
}
