import type OpenAI from "openai";
import { getVoiceV3BasicOpenAiClient } from "@/lib/voice-v3-basic/openai-client";
import {
  VOICE_V3_BASIC_BACKEND_MODEL,
  VOICE_V3_BASIC_LIVE_MODEL,
} from "@/lib/voice-v3-basic/live-session-config";
import {
  logGreetingAudioCompleted,
  logGreetingAudioStarted,
  requestInitialLiveGreeting,
} from "./greeting";
import { getVoiceV3LiveResponseCoordinator } from "./delegation/live-response-coordinator";
import {
  markGreetingCompleted,
  markGreetingSpeaking,
  noteCallerSpeechDuringGreeting,
} from "./greeting/greeting-turn";
import { maybeRequestDeferredRecoverySpeak } from "./greeting/deferred-recovery-speak";
import {
  appendCallerTranscriptDelta,
  commitCallerTranscript,
} from "./intake/caller-turn-buffer";
import { noteCallerTranscriptDelta } from "./conversation/caller-turn-manager";
import { appendAssistantTranscriptFragment } from "./conversation/transcript-accumulator";
import {
  clearDelegatedMeaningSessionState,
  handleDelegatedAstraResponseEvent,
} from "./intake/handle-delegated-meaning";
import { deleteVoiceV3CallRuntime, voiceV3IntakePipelineEnabled } from "./state/call-runtime";
import { VoiceV3CallTrace } from "./telemetry/call-trace";
import {
  noteCallerSpeechStartedTiming,
  noteSemanticTimingEvent,
} from "./telemetry/caller-turn-timing";
import {
  logVoiceV3Pipeline,
  logVoiceV3SidebandOutbound,
  shouldLogAstraNestedType,
  summarizeAstraNestedEvent,
} from "./telemetry/pipeline-log";

/**
 * Attach sideband observer (non-blocking). Never await from webhook / accept path.
 */
export function attachVoiceV3LiveSideband(input: {
  sessionId: string;
  callId?: string | null;
  client?: OpenAI;
}): void {
  if (process.env.VOICE_V3_BASIC_SIDEBAND_OBSERVER === "0") return;
  void attachVoiceV3LiveSidebandInner(input).catch((err) => {
    console.error("VOICE_V3_BASIC_SIDEBAND_ATTACH_FAILED", {
      sessionId: input.sessionId,
      err,
    });
  });
}

async function attachVoiceV3LiveSidebandInner(input: {
  sessionId: string;
  callId?: string | null;
  client?: OpenAI;
}): Promise<void> {
  const sessionId = input.sessionId.trim();
  const trace = VoiceV3CallTrace.getOrCreate({
    liveSessionId: sessionId,
    callId: input.callId,
    frontendModel: VOICE_V3_BASIC_LIVE_MODEL,
    backendModel: VOICE_V3_BASIC_BACKEND_MODEL,
  });

  // Load from node_modules (see serverExternalPackages) — Next must not webpack-bundle `ws`.
  await import("ws");
  const { SidebandWS } = await import("openai/resources/live/sideband/ws");
  const client = input.client ?? getVoiceV3BasicOpenAiClient();
  const sideband = new SidebandWS(client, { session_id: sessionId });
  let sidebandConnectedLogged = false;

  let greetingAudioStarted = false;
  let greetingAudioCompleted = false;
  let callerSpeechActive = false;
  let greetingOutputChars = 0;

  let send: (event: { type: string; [key: string]: unknown }) => void;
  send = (event: { type: string; [key: string]: unknown }) => {
    trace.onSidebandOutbound();
    logVoiceV3SidebandOutbound({ liveSessionId: sessionId, event });
    getVoiceV3LiveResponseCoordinator(sessionId, send);
    sideband.send(event as Parameters<typeof sideband.send>[0]);
  };

  sideband.on("event", (serverEvent: {
    type?: string;
    delegation?: unknown;
    delegation_id?: string | null;
    event?: unknown;
  }) => {
    const type = serverEvent?.type;

    if (type && type !== "session.output_audio.delta" && type !== "session.output_transcript.delta") {
      logVoiceV3Pipeline("sideband", type, {
        live_session_id: sessionId,
        has_delegation: Boolean(serverEvent.delegation),
      });
    }

    if (!sidebandConnectedLogged && type) {
      sidebandConnectedLogged = true;
      console.log("VOICE_V3_SIDEBAND_CONNECTED", { sessionId, first_event_type: type });
      logVoiceV3Pipeline("sideband", "connected", {
        live_session_id: sessionId,
        first_event_type: type,
      });
    }

    if (type === "session.started") {
      trace.mark("live.session.started");
      try {
        requestInitialLiveGreeting({ sessionId, send, trace });
      } catch (err) {
        console.error("LIVE_GREETING_FAILED", { sessionId, err });
      }
    }

    if (type === "session.delegation.created") {
      commitCallerTranscript(sessionId);
      const delegation = serverEvent.delegation as {
        id?: string;
        response_id?: string;
      } | undefined;
      const offset_ms =
        typeof serverEvent.offset_ms === "number" ? serverEvent.offset_ms : undefined;
      if (delegation) {
        getVoiceV3LiveResponseCoordinator(sessionId, send).onDelegationCreated({
          ...delegation,
          offset_ms,
        });
        console.log("FRESH_DELEGATION_CREATED", {
          live_session_id: sessionId,
          delegation_id: delegation.id,
          response_id: delegation.response_id ?? null,
          offset_ms: offset_ms ?? null,
        });
      }
      trace.onDelegationCreated();
      console.log("ASTRA_DELEGATION_STARTED", { sessionId, delegation: serverEvent.delegation });
      console.log("VOICE_V3_BASIC_DELEGATION_CREATED", { sessionId, delegation: serverEvent.delegation });
      logVoiceV3Pipeline("astra", "delegation.created", {
        live_session_id: sessionId,
        delegation: serverEvent.delegation,
      });
    }

    if (type === "response.event") {
      const nested = serverEvent.event as Record<string, unknown> | undefined;
      const nestedType = typeof nested?.type === "string" ? nested.type : undefined;
      trace.onAstraResponseEvent(nestedType);
      if (nested && nestedType && shouldLogAstraNestedType(nestedType)) {
        trace.onAstraNestedEventLogged();
        logVoiceV3Pipeline("astra", "nested", {
          live_session_id: sessionId,
          ...summarizeAstraNestedEvent(nested),
        });
      }
      console.log("VOICE_V3_BASIC_ASTRA_RESPONSE_EVENT", {
        sessionId,
        nestedType,
      });

      if (voiceV3IntakePipelineEnabled() && nested) {
        handleDelegatedAstraResponseEvent({
          liveSessionId: sessionId,
          nested,
          send,
          delegationId: serverEvent.delegation_id,
        });
      }
    }

    if (type === "session.output_audio.delta") {
      if (!greetingAudioStarted) {
        greetingAudioStarted = true;
        markGreetingSpeaking(sessionId);
        logGreetingAudioStarted(sessionId, trace);
      }
      trace.mark("agent.audio.started");
      noteSemanticTimingEvent(sessionId, "agentAudioStartedAt");
    }

    if (type === "session.output_transcript.delta") {
      const delta = serverEvent as { delta?: string };
      const text = typeof delta.delta === "string" ? delta.delta : "";
      if (text) appendAssistantTranscriptFragment(sessionId, text);
      greetingOutputChars += text.length;
      if (greetingAudioStarted && !greetingAudioCompleted && greetingOutputChars > 20) {
        greetingAudioCompleted = true;
        markGreetingCompleted(sessionId);
        logGreetingAudioCompleted(sessionId, trace);
        maybeRequestDeferredRecoverySpeak({ liveSessionId: sessionId, send });
      }
    }

    if (type === "session.input_transcript.delta") {
      trace.mark("caller.transcript.activity");
      const delta = serverEvent as { delta?: string };
      const text = typeof delta.delta === "string" ? delta.delta : "";
      if (text) {
        appendCallerTranscriptDelta(sessionId, text);
        noteCallerTranscriptDelta(sessionId, text);
      }
      noteCallerSpeechDuringGreeting(sessionId);
      if (!callerSpeechActive) {
        callerSpeechActive = true;
        trace.mark("caller.speech.started");
        noteCallerSpeechStartedTiming(sessionId);
      }
    }

    if (type === "session.closed") {
      logVoiceV3Pipeline("sideband", "session.closed", { live_session_id: sessionId });
      if (callerSpeechActive) {
        trace.mark("caller.speech.ended");
      }
      if (voiceV3IntakePipelineEnabled()) {
        getVoiceV3LiveResponseCoordinator(sessionId, send).markSessionClosed();
        clearDelegatedMeaningSessionState(sessionId);
        deleteVoiceV3CallRuntime(sessionId);
      }
      trace.finalize("session.closed");
      sideband.close();
    }
  });

  sideband.on("error", (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    trace.recordError(message);
    console.error("VOICE_V3_BASIC_SIDEBAND_ERROR", { sessionId, err });
    logVoiceV3Pipeline("sideband", "error", {
      live_session_id: sessionId,
      message,
    });
  });
}
