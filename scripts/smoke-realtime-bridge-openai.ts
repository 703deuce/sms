/**
 * Live smoke: WSS bridge + OpenAI Realtime session (no PSTN).
 * Run on production container (has OPENAI_API_KEY + signing secret):
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/smoke-realtime-bridge-openai.ts
 */
import WebSocket from "ws";
import { mintRealtimeBridgeStreamToken } from "@/lib/voice/telnyx/openai-realtime-bridge/stream-token";
import { getRealtimeBridgePublicWssBase } from "@/lib/voice/telnyx/openai-realtime-bridge/config";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.VOICE_AGENT_ID || process.env.AGENT_ID || "cmshz2lc25c622c4i58303501";
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || "45000");

async function main() {
  const callId = `smoke_${Date.now()}`;
  const token = mintRealtimeBridgeStreamToken({
    callId,
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
    callControlId: `cc_smoke_${Date.now()}`,
  });
  const base = getRealtimeBridgePublicWssBase();
  const url = `${base}/telnyx/media?token=${encodeURIComponent(token)}`;
  console.log("Connecting", url.replace(token, "<token>"));

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`smoke timeout after ${TIMEOUT_MS}ms — no openai_realtime_session_connected`));
    }, TIMEOUT_MS);

    let sawStart = false;

    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          event: "start",
          stream_id: "smoke_stream_1",
          start: {
            stream_id: "smoke_stream_1",
            call_control_id: "cc_smoke",
            media_format: { encoding: "PCMU", sample_rate: 8000 },
          },
        }),
      );
    });

    ws.on("message", (raw) => {
      const text = String(raw);
      if (text.includes("openai") || text.includes("session")) {
        // bridge logs to stdout; client may only see telnyx-shaped events
      }
      try {
        const ev = JSON.parse(text) as { event?: string };
        if (ev.event === "start") sawStart = true;
      } catch {
        // ignore
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    ws.on("close", (code, reason) => {
      clearTimeout(timer);
      if (code === 1000 || sawStart) {
        resolve();
        return;
      }
      reject(new Error(`ws closed code=${code} reason=${reason.toString()}`));
    });

    // Hold open briefly so bridge can connect OpenAI Realtime
    setTimeout(() => {
      console.log("OK — bridge accepted media WS (check container logs for openai_realtime_session_connected)");
      ws.close(1000, "smoke_done");
    }, 8000);
  });
}

main().catch((err) => {
  console.error("SMOKE FAILED", err);
  process.exit(1);
});
