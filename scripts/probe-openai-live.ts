/**
 * OpenAI-only Live probe: session.start → session.started (production container).
 */
import WebSocket from "ws";
import { getOpenAiApiKey } from "@/lib/voice/telnyx/openai-realtime-bridge/config";
import {
  OPENAI_LIVE_MODEL_ID,
  OPENAI_LIVE_VOICE,
  OPENAI_LIVE_WEBSOCKET_URL,
  buildOpenAiLiveSessionStartPayload,
} from "@/lib/voice/telnyx/openai-live-bridge/live-config";

const TIMEOUT_MS = Number(process.env.PROBE_TIMEOUT_MS || "10000");

async function main() {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  console.log("CONFIG", {
    url: OPENAI_LIVE_WEBSOCKET_URL,
    model: OPENAI_LIVE_MODEL_ID,
    voice: OPENAI_LIVE_VOICE,
  });

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(OPENAI_LIVE_WEBSOCKET_URL, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "Transovo-LiveProbe/1.0",
      },
    });

    const timeout = setTimeout(() => {
      console.error("FAIL: session.started not received");
      ws.close();
      reject(new Error("timeout"));
    }, TIMEOUT_MS);

    ws.on("open", () => {
      console.log("CONNECTED");
      ws.send(JSON.stringify(buildOpenAiLiveSessionStartPayload()));
      console.log("SENT session.start");
    });

    ws.on("message", (raw) => {
      const event = JSON.parse(String(raw)) as Record<string, unknown>;
      console.log("EVENT", event.type);
      if (event.type === "error") {
        console.error("OPENAI ERROR", event.error ?? event);
      }
      if (event.type === "session.started") {
        clearTimeout(timeout);
        const session = event.session as { id?: string; model?: string } | undefined;
        console.log("SUCCESS", {
          sessionId: session?.id,
          model: session?.model ?? OPENAI_LIVE_MODEL_ID,
        });
        ws.send(JSON.stringify({ type: "session.close" }));
      }
    });

    ws.on("close", (code, reason) => {
      clearTimeout(timeout);
      console.log("CLOSED", code, reason.toString());
      resolve();
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
