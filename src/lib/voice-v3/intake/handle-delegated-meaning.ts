import { dispatchFindAvailabilityIfRequired } from "../calendar/find-dispatch";
import { buildLiveSelectedSlotSessionAppend } from "../calendar/live-selected-slot-context";
import {
  buildSessionThinkingAppendForRuntime,
  getVoiceV3CallRuntime,
} from "../state/call-runtime";
import { validateCallerMeaningFromRaw } from "./decode-delegated-caller-meaning";
import { extractCallerMeaningFromAstraResponseEvent } from "./parse-astra-meaning-response";

const meaningStartedSessions = new Set<string>();

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
    console.log("ASTRA_MEANING_FAILED", {
      call_id: runtime?.getSnapshot().callId ?? null,
      live_session_id: sessionId,
      reason: "response.failed",
    });
    meaningStartedSessions.delete(sessionId);
    return;
  }

  const completionTypes = new Set([
    "response.completed",
    "response.output_text.done",
    "response.output_item.done",
  ]);

  if (!completionTypes.has(nestedType)) {
    return;
  }

  queueMicrotask(() => {
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
      if (nestedType === "response.completed" || nestedType === "response.output_item.done") {
        console.log("ASTRA_MEANING_FAILED", {
          call_id: runtime.getSnapshot().callId,
          live_session_id: sessionId,
          reason: "schema_validation_or_empty",
        });
      }
      meaningStartedSessions.delete(sessionId);
      return;
    }

    const { meaning, transport } = extracted;
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
    if (
      afterSelected &&
      (!beforeSelected ||
        beforeSelected.slotId !== afterSelected.slotId ||
        beforeSelected.offerSetId !== afterSelected.offerSetId)
    ) {
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

    void dispatchFindAvailabilityIfRequired(runtime, {
      onLiveContext: (event) => input.send(event),
    }).catch((err) => {
      console.error("FIND_AVAILABILITY_DISPATCH_ERROR", {
        live_session_id: sessionId,
        err,
      });
    });

    meaningStartedSessions.delete(sessionId);
  });
}

export function clearDelegatedMeaningSessionState(liveSessionId: string): void {
  meaningStartedSessions.delete(liveSessionId);
}
