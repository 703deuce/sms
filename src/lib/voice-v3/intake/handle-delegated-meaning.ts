import {
  buildSessionThinkingAppendForRuntime,
  getVoiceV3CallRuntime,
} from "../state/call-runtime";
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

  if (
    nestedType !== "response.completed" &&
    nestedType !== "response.output_text.done"
  ) {
    return;
  }

  queueMicrotask(() => {
    const runtime = getVoiceV3CallRuntime(sessionId);
    if (!runtime) {
      meaningStartedSessions.delete(sessionId);
      return;
    }

    const snap = runtime.getSnapshot();
    const meaning = extractCallerMeaningFromAstraResponseEvent(input.nested, runtime.config, {
      callId: snap.callId,
      liveSessionId: snap.liveSessionId,
      stateVersion: snap.runtime.version,
    });
    if (!meaning) {
      if (nestedType === "response.completed") {
        console.log("ASTRA_MEANING_FAILED", {
          call_id: runtime.getSnapshot().callId,
          live_session_id: sessionId,
          reason: "schema_validation_or_empty",
        });
      }
      meaningStartedSessions.delete(sessionId);
      return;
    }

    const startedAt = Date.now();
    runtime.applyEvent({
      type: "CALLER_MEANING_APPLIED",
      meaning,
      astraLatencyMs: 0,
    });

    console.log("ASTRA_MEANING_COMPLETED", {
      call_id: runtime.getSnapshot().callId,
      live_session_id: sessionId,
      state_version: runtime.getSnapshot().runtime.version,
      astra_latency_ms: Date.now() - startedAt,
    });

    input.send(buildSessionThinkingAppendForRuntime(runtime));
    meaningStartedSessions.delete(sessionId);
  });
}

export function clearDelegatedMeaningSessionState(liveSessionId: string): void {
  meaningStartedSessions.delete(liveSessionId);
}
