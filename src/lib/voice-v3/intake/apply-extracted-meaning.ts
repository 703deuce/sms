import { evaluateVoiceV3Rules } from "../state/call-rules";
import { dispatchFindAvailabilityIfRequired } from "../calendar/find-dispatch";
import { dispatchBookingIfRequired } from "../calendar/book-dispatch";
import { dispatchAppointmentManagementIfRequired } from "../calendar/appointment-management-dispatch";
import { buildLiveSelectedSlotSessionAppend } from "../calendar/live-selected-slot-context";
import {
  buildSessionThinkingAppendForRuntime,
  type VoiceV3CallRuntime,
} from "../state/call-runtime";
import type { VoiceV3LiveRuntimeHooks } from "../live-runtime-hooks";
import { requestLiveSpeakContinuation } from "../live-response-trigger";
import { VoiceV3CallTrace } from "../telemetry/call-trace";
import { logVoiceV3Pipeline } from "../telemetry/pipeline-log";
import type { CallerMeaning } from "./caller-meaning-schema";
import { validateCallerMeaningFromRaw } from "./decode-delegated-caller-meaning";
import type { SelectedAvailabilitySlot } from "../calendar/selected-slot";
import { pushVoiceV3RecoveryToLive } from "../recovery/push-recovery-to-live";
import { registerVoiceV3LiveSend } from "../state/call-runtime";

function slotSelectionChanged(
  before: SelectedAvailabilitySlot | null,
  after: SelectedAvailabilitySlot | null,
): boolean {
  if (!after) return false;
  if (!before) return true;
  return before.slotId !== after.slotId || before.offerSetId !== after.offerSetId;
}

export type MeaningTransport = "function_tool" | "output_text";

export async function applyExtractedCallerMeaning(input: {
  runtime: VoiceV3CallRuntime;
  liveSessionId: string;
  meaning: CallerMeaning;
  transport: MeaningTransport;
  send: (event: { type: string; [key: string]: unknown }) => void;
  source?: "delegation" | "semantic_retry";
}): Promise<void> {
  const sessionId = input.liveSessionId;
  const runtime = input.runtime;
  const snap = runtime.getSnapshot();
  const logCtx = {
    callId: snap.callId,
    liveSessionId: snap.liveSessionId,
    stateVersion: snap.runtime.version,
  };

  const revalidate = validateCallerMeaningFromRaw(input.meaning, runtime.config, logCtx);
  if (!revalidate.ok) {
    console.log("ASTRA_MEANING_SCHEMA_INVALID", {
      call_id: snap.callId,
      live_session_id: sessionId,
      reason: revalidate.reason,
      source: input.source ?? "delegation",
    });
    return;
  }

  VoiceV3CallTrace.peek(sessionId)?.onMeaningReceived();
  logVoiceV3Pipeline("meaning", "received", {
    call_id: snap.callId,
    live_session_id: sessionId,
    transport: input.transport,
    source: input.source ?? "delegation",
    state_version: snap.runtime.version,
    active_goal: revalidate.meaning.active_goal,
    captured_field_keys: revalidate.meaning.captured_fields.map((r) => r.key),
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
  }

  console.log("ASTRA_MEANING_COMPLETED", {
    call_id: runtime.getSnapshot().callId,
    live_session_id: sessionId,
    state_version: runtime.getSnapshot().runtime.version,
    astra_latency_ms: Date.now() - startedAt,
    transport: input.transport,
    source: input.source ?? "delegation",
  });

  registerVoiceV3LiveSend(sessionId, input.send);

  const snapBefore = runtime.getSnapshot();
  const rulesBefore = evaluateVoiceV3Rules(snapBefore, runtime.config);
  logVoiceV3Pipeline("calendar", "post_meaning_pipeline_start", {
    call_id: snapBefore.callId,
    live_session_id: sessionId,
    source: input.source ?? "delegation",
    required_action: rulesBefore.requiredAction,
    may_find_availability: rulesBefore.mayFindAvailability,
    booking_ready: rulesBefore.bookingReady,
    find_ready: rulesBefore.findReady,
  });

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

  await dispatchFindAvailabilityIfRequired(runtime, liveHooks);
  await dispatchBookingIfRequired(runtime, liveHooks);
  await dispatchAppointmentManagementIfRequired(runtime, liveHooks);

  if (!spokeContinuation.value) {
    if (slotChanged && afterSelected) {
      requestLiveSpeakContinuation({
        send: input.send,
        liveSessionId: sessionId,
        reason: "slot_selected",
      });
      spokeContinuation.value = true;
    }
  }

  pushVoiceV3RecoveryToLive({
    runtime,
    liveSessionId: sessionId,
    hooks: liveHooks,
    speakReason: "workflow_recovery",
  });
}
