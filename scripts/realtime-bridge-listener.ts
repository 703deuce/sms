/**
 * Long-lived Telnyx ↔ OpenAI Realtime media bridge (separate from one-shot node-web-boot).
 * Started from scripts/start-production.mjs alongside Next.js.
 */
import { startTelnyxRealtimeBridgeServer } from "@/lib/voice/telnyx/openai-realtime-bridge/ws-server";

async function main() {
  if (process.env.VOICE_V2_OPENAI_REALTIME_BRIDGE === "0") {
    console.log(
      JSON.stringify({
        service: "transovo-web",
        event: "telnyx_openai_realtime_bridge_disabled",
        timestamp: new Date().toISOString(),
      }),
    );
    return;
  }
  await startTelnyxRealtimeBridgeServer();
}

main().catch((err) => {
  console.error("[realtime-bridge-listener] failed", err);
  process.exit(1);
});
