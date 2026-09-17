/**
 * Minimal OpenAI LIVE API handshake (session.start → session.started).
 * NO Telnyx, NO tools, NO instructions beyond optional model test.
 */
import WebSocket from "ws";
import { getOpenAiApiKey } from "@/lib/voice/telnyx/openai-realtime-bridge/config";
import { OPENAI_REALTIME_MINI_MODEL_ID, OPENAI_REALTIME_BRIDGE_VOICE } from "@/lib/voice/telnyx/openai-realtime-bridge/flags";

const MODEL = process.env.OPENAI_LIVE_MODEL?.trim() || OPENAI_REALTIME_MINI_MODEL_ID;
const HOLD_MS = Number(process.env.HOLD_MS || "10000");
const LIVE_URL = "wss://api.openai.com/v1/live/sessions";

function log(msg: string, extra?: Record<string, unknown>) {
  console.log(msg, extra ? JSON.stringify(extra) : "");
}

async function main() {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  log("LIVE_PROBE_CONFIG", {
    url: LIVE_URL,
    model: MODEL,
    voice: OPENAI_REALTIME_BRIDGE_VOICE,
    hold_ms: HOLD_MS,
  });

  let openedAt = 0;
  let started = false;
  let lastClientEvent = "";

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(LIVE_URL, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "Transovo-VoiceV2-RealtimeBridge/1.0",
      },
    });

    const timer = setTimeout(() => {
      if (started) {
        log("LIVE_PROBE_PASS", { held_ms: HOLD_MS });
        ws.close();
        resolve();
      } else {
        reject(new Error("timeout_before_session.started"));
      }
    }, HOLD_MS);

    ws.on("open", () => {
      openedAt = Date.now();
      log("OPENAI_WS_OPEN");
      const startEv = {
        type: "session.start",
        event_id: "probe_start_1",
        session: {
          model: MODEL,
          instructions: "You are a test assistant. Stay silent until spoken to.",
          audio: {
            format: { type: "audio/pcmu", rate: 8000 },
            output: { voice: OPENAI_REALTIME_BRIDGE_VOICE },
          },
        },
      };
      lastClientEvent = "session.start";
      log("OPENAI_SEND", { type: startEv.type, model: MODEL });
      ws.send(JSON.stringify(startEv));
    });

    ws.on("message", (raw) => {
      const ev = JSON.parse(String(raw)) as Record<string, unknown>;
      const type = String(ev.type || "");
      log("OPENAI_SERVER_EVENT", { type, event_id: ev.event_id });
      if (type === "error") {
        const err = (ev.error ?? ev) as Record<string, unknown>;
        log("OPENAI_ERROR", {
          error_type: err.type,
          error_code: err.code,
          error_message: err.message,
          error_param: err.param,
        });
      }
      if (type === "session.started") {
        started = true;
        log("OPENAI_SESSION_STARTED", { session_id: (ev.session as { id?: string })?.id });
      }
    });

    ws.on("close", (code, reason) => {
      clearTimeout(timer);
      log("OPENAI_WS_CLOSE", {
        code,
        reason: reason.toString(),
        time_since_open_ms: openedAt ? Date.now() - openedAt : null,
        session_started: started,
        last_client_event: lastClientEvent,
      });
      if (!started) reject(new Error(`closed_before_started code=${code}`));
      else resolve();
    });

    ws.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

main().catch((e) => {
  console.error("LIVE_PROBE_FAIL", e);
  process.exit(1);
});
