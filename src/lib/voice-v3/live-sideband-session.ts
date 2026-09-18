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
import {
  clearDelegatedMeaningSessionState,
  handleDelegatedAstraResponseEvent,
} from "./intake/handle-delegated-meaning";
import { deleteVoiceV3CallRuntime, voiceV3IntakePipelineEnabled } from "./state/call-runtime";
import { VoiceV3CallTrace } from "./telemetry/call-trace";

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

  const { SidebandWS } = await import("openai/resources/live/sideband/ws");
  const client = input.client ?? getVoiceV3BasicOpenAiClient();
  const sideband = new SidebandWS(client, { session_id: sessionId });
  let sidebandConnectedLogged = false;

  let greetingAudioStarted = false;
  let greetingAudioCompleted = false;
  let callerSpeechActive = false;
  let greetingOutputChars = 0;

  const send = (event: { type: string; [key: string]: unknown }) => {
    sideband.send(event as Parameters<typeof sideband.send>[0]);
  };

  sideband.on("event", (serverEvent: { type?: string; delegation?: unknown; event?: unknown }) => {
    const type = serverEvent?.type;

    if (!sidebandConnectedLogged && type) {
      sidebandConnectedLogged = true;
      console.log("VOICE_V3_SIDEBAND_CONNECTED", { sessionId, first_event_type: type });
    }

    if (type === "session.started") {
      trace.mark("live.session.started");
      requestInitialLiveGreeting({ sessionId, send, trace });
    }

    if (type === "session.delegation.created") {
      trace.onDelegationCreated();
      console.log("ASTRA_DELEGATION_STARTED", { sessionId, delegation: serverEvent.delegation });
      console.log("VOICE_V3_BASIC_DELEGATION_CREATED", { sessionId, delegation: serverEvent.delegation });
    }

    if (type === "response.event") {
      const nested = serverEvent.event as Record<string, unknown> | undefined;
      const nestedType = typeof nested?.type === "string" ? nested.type : undefined;
      trace.onAstraResponseEvent(nestedType);
      console.log("VOICE_V3_BASIC_ASTRA_RESPONSE_EVENT", {
        sessionId,
        nestedType,
      });

      if (voiceV3IntakePipelineEnabled() && nested) {
        handleDelegatedAstraResponseEvent({
          liveSessionId: sessionId,
          nested,
          send,
        });
      }
    }

    if (type === "session.output_audio.delta") {
      if (!greetingAudioStarted) {
        greetingAudioStarted = true;
        logGreetingAudioStarted(sessionId, trace);
      }
      trace.mark("agent.audio.started");
    }

    if (type === "session.output_transcript.delta") {
      const delta = serverEvent as { delta?: string };
      const text = typeof delta.delta === "string" ? delta.delta : "";
      greetingOutputChars += text.length;
      if (greetingAudioStarted && !greetingAudioCompleted && greetingOutputChars > 20) {
        greetingAudioCompleted = true;
        logGreetingAudioCompleted(sessionId, trace);
      }
    }

    if (type === "session.input_transcript.delta") {
      trace.mark("caller.transcript.activity");
      if (!callerSpeechActive) {
        callerSpeechActive = true;
        trace.mark("caller.speech.started");
      }
    }

    if (type === "session.closed") {
      if (callerSpeechActive) {
        trace.mark("caller.speech.ended");
      }
      if (voiceV3IntakePipelineEnabled()) {
        clearDelegatedMeaningSessionState(sessionId);
        deleteVoiceV3CallRuntime(sessionId);
      }
      trace.finalize("session.closed");
      sideband.close();
    }
  });

  sideband.on("error", (err: unknown) => {
    trace.recordError(err instanceof Error ? err.message : String(err));
    console.error("VOICE_V3_BASIC_SIDEBAND_ERROR", { sessionId, err });
  });
}
