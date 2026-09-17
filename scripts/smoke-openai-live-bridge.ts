/**
 * Telnyx media WS → Live bridge smoke (no PSTN). Requires VOICE_AI_TRANSPORT=openai_live on listener.
 */
import WebSocket from "ws";
import { mintRealtimeBridgeStreamToken } from "@/lib/voice/telnyx/openai-realtime-bridge/stream-token";
import { getRealtimeBridgePublicWssBase } from "@/lib/voice/telnyx/openai-realtime-bridge/config";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.VOICE_AGENT_ID || process.env.AGENT_ID || "cmshz2lc25c622c4i58303501";

async function main() {
  const token = mintRealtimeBridgeStreamToken({
    callId: `live_smoke_${Date.now()}`,
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
    callControlId: `cc_live_smoke_${Date.now()}`,
  });
  const url = `${getRealtimeBridgePublicWssBase()}/telnyx/media?token=${encodeURIComponent(token)}`;
  console.log("Connecting", url.replace(token, "<token>"));

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.close(1000, "smoke_done");
      resolve();
    }, 12000);

    ws.on("open", () => {
      ws.send(JSON.stringify({ event: "connected" }));
      ws.send(
        JSON.stringify({
          event: "start",
          stream_id: "live_smoke_stream_1",
          start: {
            stream_id: "live_smoke_stream_1",
            media_format: { encoding: "PCMU", sample_rate: 8000 },
          },
        }),
      );
    });

    ws.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    ws.on("close", (code, reason) => {
      clearTimeout(timer);
      if (code === 1000 || code === 1005) resolve();
      else reject(new Error(`close ${code} ${reason}`));
    });
  });

  console.log("OK — check logs for openai_session_started (live transport)");
}

main().catch((e) => {
  console.error("SMOKE FAILED", e);
  process.exit(1);
});
