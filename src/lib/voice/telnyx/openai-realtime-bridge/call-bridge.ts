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

type TelnyxMediaEvent = {
  event?: string;
  media?: { payload?: string; track?: string };
  stream_id?: string;
};

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

  const tools = buildOpenAiRealtimeVoiceV2Tools({
    config: parsed,
    transferEnabled: Boolean(handling?.transferEnabled),
  });

  const model = OPENAI_REALTIME_MINI_MODEL_ID;
  const openAiUrl = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;
  const openAi = new WebSocket(openAiUrl, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "OpenAI-Beta": "realtime=v1",
    },
  });

  let streamId: string | null = null;
  let toolBusy = false;
  let firstAmyAudioLogged = false;
  let openAiSessionLogged = false;
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
      openAi.send(JSON.stringify(event));
    }
  };

  const sendTelnyxMedia = (payloadB64: string) => {
    if (!streamId || input.telnyxSocket.readyState !== WebSocket.OPEN) return;
    input.telnyxSocket.send(
      JSON.stringify({
        event: "media",
        stream_id: streamId,
        media: { payload: payloadB64 },
      }),
    );
  };

  openAi.on("open", () => {
    if (!openAiSessionLogged) {
      openAiSessionLogged = true;
      logRealtimeBridgeEvent("openai_realtime_session_connected", {
        callId: input.claims.callId,
        model,
        voice: OPENAI_REALTIME_BRIDGE_VOICE,
        input_audio_format: "g711_ulaw",
        output_audio_format: "g711_ulaw",
        session_mode: "single_persistent_per_call",
      });
    }
    sendOpenAi({
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions,
        voice: OPENAI_REALTIME_BRIDGE_VOICE,
        input_audio_format: "g711_ulaw",
        output_audio_format: "g711_ulaw",
        turn_detection: { type: "server_vad" },
        tools: tools.map((t) => ({
          type: "function",
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
        tool_choice: "auto",
      },
    });
    if (greeting) {
      sendOpenAi({
        type: "response.create",
        response: {
          modalities: ["audio", "text"],
          instructions: `Say exactly this greeting naturally: ${greeting}`,
        },
      });
    }
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
    if (ev.event === "connected" || ev.event === "start") {
      streamId = ev.stream_id || streamId;
      return;
    }
    if (ev.event === "media" && ev.media?.payload) {
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

  const closeBoth = () => {
    logRealtimeBridgeEvent("bridge_session_closed", { callId: input.claims.callId });
    try {
      openAi.close();
    } catch {
      /* ignore */
    }
    try {
      input.telnyxSocket.close();
    } catch {
      /* ignore */
    }
  };

  openAi.on("close", closeBoth);
  input.telnyxSocket.on("close", () => openAi.close());
  openAi.on("error", (err) => console.error("[realtime-bridge] openai ws", err));
  input.telnyxSocket.on("error", (err) => console.error("[realtime-bridge] telnyx ws", err));
}
