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

type TelnyxMediaEvent = {
  event?: string;
  media?: { payload?: string; track?: string };
  stream_id?: string;
};

export async function runTelnyxOpenAiRealtimeBridge(input: {
  claims: RealtimeBridgeStreamClaims;
  telnyxSocket: WebSocket;
}): Promise<void> {
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

    if (type === "response.audio.delta" && ev.delta) {
      sendTelnyxMedia(String(ev.delta));
      return;
    }

    if (type === "response.function_call_arguments.done") {
      if (toolBusy) return;
      toolBusy = true;
      const callId = String(ev.call_id || "");
      const name = String(ev.name || "");
      const argsJson = String(ev.arguments || "{}");
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(argsJson) as Record<string, unknown>;
      } catch {
        args = {};
      }
      const generationAtStart = toolCtx.schedulingGeneration;
      try {
        const { output, discard } = await dispatchOpenAiRealtimeVoiceV2Tool({
          toolName: name,
          args,
          openAiFunctionCallId: callId,
          ctx: toolCtx,
        });
        if (discard || generationAtStart !== toolCtx.schedulingGeneration) {
          sendOpenAi({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: callId,
              output: JSON.stringify({
                ok: false,
                speak: "Let me check again with your updated preference.",
                superseded: true,
              }),
            },
          });
        } else {
          sendOpenAi({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: callId,
              output,
            },
          });
        }
        sendOpenAi({ type: "response.create" });
      } finally {
        toolBusy = false;
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
      openAi.close();
    }
  });

  const closeBoth = () => {
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
