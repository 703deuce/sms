import WebSocket from "ws";
import { OPENAI_REALTIME_MINI_MODEL_ID, OPENAI_REALTIME_BRIDGE_VOICE } from "./flags";
import { getOpenAiApiKey } from "./config";
import type { RealtimeBridgeStreamClaims } from "./stream-token";
import { loadOpenAiRealtimeSessionInstructions } from "./instructions";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { resolveAfterHoursHandlingFromAgentConfig } from "@/lib/voice-v2/after-hours-handling-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import {
  buildOpenAiRealtimeVoiceV2Tools,
  dispatchOpenAiRealtimeVoiceV2Tool,
  type RealtimeToolDispatchContext,
} from "./realtime-tools";
import { buildVoiceV2CallCapabilitySnapshot } from "@/lib/voice-v2/workflow-capability";
import { VOICE_V2_SAVE_INTAKE_TOOL_TYPE } from "@/lib/voice-v2/telnyx-tool-definition";
import { REALTIME_SAVE_INTAKE_DEFERRED_OUTPUT } from "./realtime-tools";
import { logRealtimeBridgeEvent } from "./telemetry";
import {
  buildOpenAiRealtimeGaGreetingResponse,
  buildOpenAiRealtimeGaMinimalSessionUpdate,
  buildOpenAiRealtimeGaSessionUpdate,
  OPENAI_REALTIME_MINIMAL_AMY_INSTRUCTIONS,
} from "./ga-session";
import {
  OPENAI_REALTIME_API_KIND,
  buildOpenAiRealtimeWebSocketHeaders,
  buildOpenAiRealtimeWebSocketUrl,
  isOpenAiRealtimeMinimalSessionEnabled,
  isOpenAiRealtimeProtocolLoggingEnabled,
  summarizeOpenAiClientEvent,
  summarizeOpenAiServerEvent,
} from "./openai-realtime-protocol";

type TelnyxMediaEvent = {
  event?: string;
  media?: { payload?: string; track?: string };
  stream_id?: string;
  start?: { stream_id?: string };
};

const MAX_BUFFERED_OUTBOUND_AUDIO_CHUNKS = 600;

function resolveTelnyxStreamId(ev: TelnyxMediaEvent): string | null {
  if (ev.stream_id) return ev.stream_id;
  if (ev.start?.stream_id) return ev.start.stream_id;
  return null;
}

/**
 * One Telnyx media WebSocket ↔ one OpenAI Realtime WebSocket for the full PSTN call.
 * Do not open a new OpenAI session per utterance or tool call.
 */
export async function runTelnyxOpenAiRealtimeBridge(input: {
  claims: RealtimeBridgeStreamClaims;
  telnyxSocket: WebSocket;
}): Promise<void> {
  logRealtimeBridgeEvent("telnyx_media_ws_connected", {
    callId: input.claims.callId,
    workspaceId: input.claims.workspaceId,
    agentId: input.claims.agentId,
    callControlId: input.claims.callControlId,
    legacyAssistantPath: false,
    legacySttTtsPath: false,
  });
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    input.telnyxSocket.close(1011, "openai_key_missing");
    return;
  }

  const config = await loadVoiceAgentRuntimeConfig(input.claims.workspaceId, input.claims.agentId);
  const parsed = parseVoiceAgentConfig(config);
  const handling = resolveAfterHoursHandlingFromAgentConfig(parsed);
  const { instructions, greeting } = await loadOpenAiRealtimeSessionInstructions({
    workspaceId: input.claims.workspaceId,
    agentId: input.claims.agentId,
  });

  const minimalSession = isOpenAiRealtimeMinimalSessionEnabled();
  const protocolLog = isOpenAiRealtimeProtocolLoggingEnabled();
  const tools = minimalSession
    ? []
    : buildOpenAiRealtimeVoiceV2Tools({
        config: parsed,
        transferEnabled: Boolean(handling?.transferEnabled),
      });

  const model = OPENAI_REALTIME_MINI_MODEL_ID;
  const openAiUrl = buildOpenAiRealtimeWebSocketUrl(model);
  const openAi = new WebSocket(openAiUrl, {
    headers: buildOpenAiRealtimeWebSocketHeaders(apiKey),
  });
  const openAiOpenedAt = { ms: 0 };
  let bridgeTornDown = false;
  let firstTelnyxMediaLogged = false;
  let firstAudioToOpenAiLogged = false;

  let streamId: string | null = null;
  let toolBusy = false;
  let firstAmyAudioLogged = false;
  let openAiSessionLogged = false;
  let openAiSessionReady = false;
  let greetingSent = false;
  let droppedOutboundAudioLogged = false;
  const outboundAudioBuffer: string[] = [];
  let lastFindGeneration = 0;
  let lastFindDate = "";
  const capability = buildVoiceV2CallCapabilitySnapshot(parsed);

  const toolCtx: RealtimeToolDispatchContext = {
    workspaceId: input.claims.workspaceId,
    agentId: input.claims.agentId,
    callId: input.claims.callId,
    callControlId: input.claims.callControlId,
    capability,
    schedulingGeneration: 0,
    onFindStarted: (requestedDate) => {
      if (requestedDate && requestedDate !== lastFindDate) {
        lastFindDate = requestedDate;
        lastFindGeneration += 1;
        toolCtx.schedulingGeneration = lastFindGeneration;
      }
    },
  };

  const sendOpenAi = (event: Record<string, unknown>) => {
    if (openAi.readyState === WebSocket.OPEN) {
      if (protocolLog) {
        logRealtimeBridgeEvent("OPENAI_SEND", {
          callId: input.claims.callId,
          ...summarizeOpenAiClientEvent(event),
        });
      }
      openAi.send(JSON.stringify(event));
    }
  };

  const sendTelnyxMediaImmediate = (payloadB64: string) => {
    if (!streamId || input.telnyxSocket.readyState !== WebSocket.OPEN) return;
    input.telnyxSocket.send(
      JSON.stringify({
        event: "media",
        media: { payload: payloadB64 },
      }),
    );
  };

  const flushOutboundAudioBuffer = () => {
    while (streamId && outboundAudioBuffer.length > 0) {
      sendTelnyxMediaImmediate(outboundAudioBuffer.shift()!);
    }
  };

  const sendTelnyxMedia = (payloadB64: string) => {
    if (!streamId || input.telnyxSocket.readyState !== WebSocket.OPEN) {
      if (outboundAudioBuffer.length < MAX_BUFFERED_OUTBOUND_AUDIO_CHUNKS) {
        outboundAudioBuffer.push(payloadB64);
      } else if (!droppedOutboundAudioLogged) {
        droppedOutboundAudioLogged = true;
        logRealtimeBridgeEvent("telnyx_outbound_audio_dropped", {
          callId: input.claims.callId,
          reason: "buffer_full_before_stream_ready",
          bufferedChunks: outboundAudioBuffer.length,
        });
      }
      return;
    }
    sendTelnyxMediaImmediate(payloadB64);
  };

  const maybeSendGreeting = () => {
    if (minimalSession || !greeting || greetingSent || !openAiSessionReady || !streamId) return;
    greetingSent = true;
    logRealtimeBridgeEvent("realtime_greeting_triggered", {
      callId: input.claims.callId,
      streamReady: Boolean(streamId),
      sessionReady: openAiSessionReady,
    });
    sendOpenAi(
      buildOpenAiRealtimeGaGreetingResponse(
        `Say exactly this greeting naturally: ${greeting}`,
      ),
    );
  };

  const onTelnyxStreamReady = (id: string) => {
    if (streamId === id) return;
    streamId = id;
    logRealtimeBridgeEvent("telnyx_media_stream_ready", {
      callId: input.claims.callId,
      streamId: id,
    });
    flushOutboundAudioBuffer();
    maybeSendGreeting();
  };

  openAi.on("open", () => {
    openAiOpenedAt.ms = Date.now();
    if (!openAiSessionLogged) {
      openAiSessionLogged = true;
      logRealtimeBridgeEvent("OPENAI_WS_OPEN", {
        callId: input.claims.callId,
        api_kind: OPENAI_REALTIME_API_KIND,
        url: openAiUrl,
        model,
        voice: OPENAI_REALTIME_BRIDGE_VOICE,
        minimal_session: minimalSession,
        protocol_log: protocolLog,
      });
      logRealtimeBridgeEvent("openai_realtime_session_connected", {
        callId: input.claims.callId,
        model,
        voice: OPENAI_REALTIME_BRIDGE_VOICE,
        input_audio_format: "audio/pcmu",
        output_audio_format: "audio/pcmu",
        session_mode: "single_persistent_per_call",
        realtime_api: "ga",
      });
    }
    // session.update is sent after session.created (not on raw WS open).
  });

  openAi.on("message", (raw) => {
    void handleOpenAiMessage(String(raw)).catch((err) => {
      console.error("[realtime-bridge] openai handler", err);
    });
  });

  async function handleOpenAiMessage(raw: string) {
    let ev: Record<string, unknown>;
    try {
      ev = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }
    const type = String(ev.type || "");

    if (protocolLog) {
      logRealtimeBridgeEvent("OPENAI_SERVER_EVENT", {
        callId: input.claims.callId,
        ...summarizeOpenAiServerEvent(ev),
      });
    }

    if (type === "error") {
      logRealtimeBridgeEvent("openai_realtime_error", {
        callId: input.claims.callId,
        ...summarizeOpenAiServerEvent(ev),
      });
      return;
    }

    if (type === "session.created") {
      const sessionPayload = minimalSession
        ? buildOpenAiRealtimeGaMinimalSessionUpdate(OPENAI_REALTIME_MINIMAL_AMY_INSTRUCTIONS)
        : buildOpenAiRealtimeGaSessionUpdate({ instructions, tools });
      sendOpenAi(sessionPayload);
      return;
    }

    if (type === "session.updated") {
      if (!openAiSessionReady) {
        openAiSessionReady = true;
        logRealtimeBridgeEvent("openai_realtime_session_ready", {
          callId: input.claims.callId,
          openAiEventType: type,
        });
        maybeSendGreeting();
      }
    }

    const audioDelta =
      (type === "response.audio.delta" || type === "response.output_audio.delta") && ev.delta
        ? String(ev.delta)
        : null;
    if (audioDelta) {
      if (!firstAmyAudioLogged) {
        firstAmyAudioLogged = true;
        logRealtimeBridgeEvent("first_amy_audio_delta", {
          callId: input.claims.callId,
          openAiEventType: type,
        });
        logRealtimeBridgeEvent("FIRST_OPENAI_AUDIO_DELTA", {
          callId: input.claims.callId,
        });
        logRealtimeBridgeEvent("FIRST_AUDIO_SENT_TO_TELNYX", {
          callId: input.claims.callId,
        });
      }
      sendTelnyxMedia(audioDelta);
      return;
    }

    if (type === "response.function_call_arguments.done") {
      if (toolBusy) return;
      toolBusy = true;
      const callId = String(ev.call_id || "");
      const name = String(ev.name || "");
      logRealtimeBridgeEvent("tool_function_call", {
        callId: input.claims.callId,
        toolName: name,
        openAiFunctionCallId: callId,
      });
      const argsJson = String(ev.arguments || "{}");
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(argsJson) as Record<string, unknown>;
      } catch {
        args = {};
      }
      const generationAtStart = toolCtx.schedulingGeneration;

      const finishTool = (output: string) => {
        sendOpenAi({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output,
          },
        });
        sendOpenAi({ type: "response.create" });
        toolBusy = false;
      };

      // Intake: mirror to canonical state without blocking the live audio session.
      if (name === VOICE_V2_SAVE_INTAKE_TOOL_TYPE) {
        finishTool(REALTIME_SAVE_INTAKE_DEFERRED_OUTPUT);
        void dispatchOpenAiRealtimeVoiceV2Tool({
          toolName: name,
          args,
          openAiFunctionCallId: callId,
          ctx: toolCtx,
        })
          .then(({ output }) => {
            logRealtimeBridgeEvent("tool_result_async", {
              callId: input.claims.callId,
              toolName: name,
              phase: "intake_persist_complete",
              outputBytes: output.length,
            });
          })
          .catch((err) => {
            console.error("[realtime-bridge] async save_intake failed", err);
            logRealtimeBridgeEvent("tool_result_async_error", {
              callId: input.claims.callId,
              toolName: name,
              message: err instanceof Error ? err.message : String(err),
            });
          });
        return;
      }

      try {
        const { output, discard } = await dispatchOpenAiRealtimeVoiceV2Tool({
          toolName: name,
          args,
          openAiFunctionCallId: callId,
          ctx: toolCtx,
        });
        logRealtimeBridgeEvent("tool_result", {
          callId: input.claims.callId,
          toolName: name,
          superseded: discard || generationAtStart !== toolCtx.schedulingGeneration,
        });
        if (discard || generationAtStart !== toolCtx.schedulingGeneration) {
          finishTool(
            JSON.stringify({
              ok: false,
              speak: "Let me check again with your updated preference.",
              superseded: true,
            }),
          );
        } else {
          finishTool(output);
        }
      } catch (err) {
        console.error("[realtime-bridge] tool dispatch failed", err);
        finishTool(
          JSON.stringify({
            ok: false,
            speak: "I hit a snag on my side — let's try that again.",
            error: "tool_dispatch_failed",
          }),
        );
      }
    }
  }

  input.telnyxSocket.on("message", (buf) => {
    let ev: TelnyxMediaEvent;
    try {
      ev = JSON.parse(buf.toString()) as TelnyxMediaEvent;
    } catch {
      return;
    }
    if (ev.event === "connected") {
      return;
    }
    if (ev.event === "start") {
      logRealtimeBridgeEvent("TELNYX_START_RECEIVED", {
        callId: input.claims.callId,
        stream_id: resolveTelnyxStreamId(ev),
      });
      const id = resolveTelnyxStreamId(ev);
      if (id) onTelnyxStreamReady(id);
      return;
    }
    if (ev.event === "media" && ev.media?.payload) {
      if (!firstTelnyxMediaLogged) {
        firstTelnyxMediaLogged = true;
        logRealtimeBridgeEvent("FIRST_TELNYX_MEDIA_RECEIVED", {
          callId: input.claims.callId,
        });
      }
      if (!firstAudioToOpenAiLogged) {
        firstAudioToOpenAiLogged = true;
        logRealtimeBridgeEvent("FIRST_AUDIO_SENT_TO_OPENAI", {
          callId: input.claims.callId,
        });
      }
      sendOpenAi({
        type: "input_audio_buffer.append",
        audio: ev.media.payload,
      });
    }
    if (ev.event === "stop") {
      logRealtimeBridgeEvent("telnyx_media_ws_stop", { callId: input.claims.callId });
      openAi.close();
    }
  });

  const teardownBridge = (source: "openai_close" | "telnyx_close" | "telnyx_stop") => {
    if (bridgeTornDown) return;
    bridgeTornDown = true;
    logRealtimeBridgeEvent("bridge_session_closed", {
      callId: input.claims.callId,
      teardown_source: source,
      openai_session_ready: openAiSessionReady,
    });
    try {
      if (openAi.readyState === WebSocket.OPEN || openAi.readyState === WebSocket.CONNECTING) {
        openAi.close();
      }
    } catch {
      /* ignore */
    }
    try {
      if (input.telnyxSocket.readyState === WebSocket.OPEN) {
        input.telnyxSocket.close();
      }
    } catch {
      /* ignore */
    }
  };

  openAi.on("close", (code, reason) => {
    const timeSinceOpenMs = openAiOpenedAt.ms ? Date.now() - openAiOpenedAt.ms : null;
    logRealtimeBridgeEvent("OPENAI_WS_CLOSE", {
      callId: input.claims.callId,
      code,
      reason: reason.toString(),
      time_since_open_ms: timeSinceOpenMs,
      session_ready: openAiSessionReady,
    });
    logRealtimeBridgeEvent("openai_realtime_ws_closed", {
      callId: input.claims.callId,
      code,
      reason: reason.toString(),
      time_since_open_ms: timeSinceOpenMs,
    });
    teardownBridge("openai_close");
  });
  input.telnyxSocket.on("close", () => {
    if (!bridgeTornDown) {
      try {
        openAi.close();
      } catch {
        /* ignore */
      }
    }
  });
  openAi.on("error", (err) => {
    console.error("[realtime-bridge] openai ws", err);
    logRealtimeBridgeEvent("openai_realtime_ws_error", {
      callId: input.claims.callId,
      message: err instanceof Error ? err.message : String(err),
    });
  });
  input.telnyxSocket.on("error", (err) => console.error("[realtime-bridge] telnyx ws", err));
}
