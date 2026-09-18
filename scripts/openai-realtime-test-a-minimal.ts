/**
 * TEST A — Standalone OpenAI Realtime handshake (no Telnyx).
 */
import WebSocket from "ws";
import { getOpenAiApiKey } from "@/lib/voice/telnyx/openai-realtime-bridge/config";
import { OPENAI_REALTIME_MINI_MODEL_ID, OPENAI_REALTIME_BRIDGE_VOICE } from "@/lib/voice/telnyx/openai-realtime-bridge/flags";
import {
  buildOpenAiRealtimeGaMinimalSessionUpdate,
  buildOpenAiRealtimeGaGreetingResponse,
  buildOpenAiRealtimeGaSessionUpdate,
} from "@/lib/voice/telnyx/openai-realtime-bridge/ga-session";
import {
  OPENAI_REALTIME_API_KIND,
  buildOpenAiRealtimeWebSocketHeaders,
  buildOpenAiRealtimeWebSocketUrl,
  summarizeOpenAiClientEvent,
  summarizeOpenAiServerEvent,
} from "@/lib/voice/telnyx/openai-realtime-bridge/openai-realtime-protocol";
import { buildOpenAiRealtimeVoiceV2Tools } from "@/lib/voice/telnyx/openai-realtime-bridge/realtime-tools";
import { loadOpenAiRealtimeSessionInstructions } from "@/lib/voice/telnyx/openai-realtime-bridge/instructions";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { resolveAfterHoursHandlingFromAgentConfig } from "@/lib/voice-receptionist-wizard/after-hours-handling-config";

const HOLD_MS = Number(process.env.HOLD_MS || "30000");
const LAYER = process.env.OPENAI_REALTIME_TEST_LAYER || "minimal";
const USE_BETA = process.env.OPENAI_REALTIME_USE_BETA === "1";
const SEND_RESPONSE = process.env.OPENAI_REALTIME_TEST_RESPONSE === "1";
const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.AGENT_ID || "cmshz2lc25c622c4i58303501";

function log(line: string, extra?: Record<string, unknown>) {
  const payload = extra ? ` ${JSON.stringify(extra)}` : "";
  console.log(`[test-a] ${line}${payload}`);
}

async function buildSessionUpdate(): Promise<Record<string, unknown>> {
  if (LAYER === "production_session") {
    const config = await loadVoiceAgentRuntimeConfig(WORKSPACE_ID, AGENT_ID);
    const parsed = parseVoiceAgentConfig(config);
    const handling = resolveAfterHoursHandlingFromAgentConfig(parsed);
    const { instructions } = await loadOpenAiRealtimeSessionInstructions({
      workspaceId: WORKSPACE_ID,
      agentId: AGENT_ID,
    });
    const tools = buildOpenAiRealtimeVoiceV2Tools({
      config: parsed,
      transferEnabled: Boolean(handling?.transferEnabled),
    });
    return buildOpenAiRealtimeGaSessionUpdate({ instructions, tools });
  }
  return buildOpenAiRealtimeGaMinimalSessionUpdate();
}

function buildBetaSessionUpdate(): Record<string, unknown> {
  return {
    type: "session.update",
    session: {
      modalities: ["text", "audio"],
      instructions: "You are Amy. Respond briefly.",
      voice: OPENAI_REALTIME_BRIDGE_VOICE,
      input_audio_format: "g711_ulaw",
      output_audio_format: "g711_ulaw",
      turn_detection: { type: "server_vad" },
    },
  };
}

async function main() {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const model = OPENAI_REALTIME_MINI_MODEL_ID;
  const url = buildOpenAiRealtimeWebSocketUrl(model);
  const headers = buildOpenAiRealtimeWebSocketHeaders(apiKey);
  if (USE_BETA) headers["OpenAI-Beta"] = "realtime=v1";

  const sessionUpdatePayload = USE_BETA
    ? buildBetaSessionUpdate()
    : await buildSessionUpdate();

  log("protocol", {
    api_kind: OPENAI_REALTIME_API_KIND,
    not_live_api: true,
    url,
    model,
    voice: OPENAI_REALTIME_BRIDGE_VOICE,
    layer: LAYER,
    use_beta_header: USE_BETA,
    hold_ms: HOLD_MS,
    send_response_after_ready: SEND_RESPONSE,
    header_names: Object.keys(headers),
  });

  let openedAt = 0;
  let sessionReady = false;
  let sawError = false;
  let settled = false;

  const result = await new Promise<{ pass: boolean; reason: string }>((resolve) => {
    const settle = (pass: boolean, reason: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(holdTimer);
      resolve({ pass, reason });
    };

    const ws = new WebSocket(url, { headers });

    const holdTimer = setTimeout(() => {
      if (!sessionReady) {
        settle(false, "timeout_before_session.updated");
        ws.close();
        return;
      }
      if (sawError) {
        settle(false, "error_event_received");
        ws.close();
        return;
      }
      settle(true, `held_open_${HOLD_MS}ms_after_session.updated`);
      ws.close();
    }, HOLD_MS);

    ws.on("open", () => {
      openedAt = Date.now();
      log("OPENAI_WS_OPEN");
    });

    ws.on("message", (raw) => {
      let ev: Record<string, unknown>;
      try {
        ev = JSON.parse(String(raw)) as Record<string, unknown>;
      } catch {
        log("OPENAI_SERVER_EVENT", { type: "parse_failed" });
        return;
      }
      const type = String(ev.type || "");
      log("OPENAI_SERVER_EVENT", summarizeOpenAiServerEvent(ev));

      if (type === "error") sawError = true;

      if (type === "session.created") {
        log("OPENAI_SEND", summarizeOpenAiClientEvent(sessionUpdatePayload));
        ws.send(JSON.stringify(sessionUpdatePayload));
      }

      if (type === "session.updated" && !sessionReady) {
        sessionReady = true;
        log("OPENAI_SESSION_READY");
        if (SEND_RESPONSE) {
          const responseEv = buildOpenAiRealtimeGaGreetingResponse(
            "Say hello in one short sentence.",
          );
          log("OPENAI_SEND", summarizeOpenAiClientEvent(responseEv));
          ws.send(JSON.stringify(responseEv));
        }
      }

      if (type === "response.output_audio.delta" || type === "response.audio.delta") {
        log("OPENAI_AUDIO_DELTA", {
          event_type: type,
          delta_chars: String(ev.delta || "").length,
        });
      }
    });

    ws.on("error", (err) => {
      log("OPENAI_WS_ERROR", { message: err instanceof Error ? err.message : String(err) });
    });

    ws.on("close", (code, reason) => {
      const timeSinceOpenMs = openedAt ? Date.now() - openedAt : null;
      log("OPENAI_WS_CLOSE", {
        code,
        reason: reason.toString(),
        time_since_open_ms: timeSinceOpenMs,
        session_ready: sessionReady,
        saw_error: sawError,
      });
      if (!settled) {
        if (!sessionReady && timeSinceOpenMs !== null && timeSinceOpenMs < 500) {
          settle(false, `early_close_${timeSinceOpenMs}ms_likely_protocol_rejection`);
        } else {
          settle(false, "closed_before_hold_complete");
        }
      }
    });
  });

  log("RESULT", result);
  if (!result.pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
