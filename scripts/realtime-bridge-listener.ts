/**
 * Legacy Telnyx ↔ OpenAI Realtime media bridge (retired for Voice V3 Basic PSTN).
 * Started from scripts/start-production.mjs only when VOICE_V2_OPENAI_REALTIME_BRIDGE=1.
 */
async function main() {
  if (process.env.VOICE_V2_OPENAI_REALTIME_BRIDGE !== "1") {
    console.log(
      JSON.stringify({
        service: "transovo-web",
        event: "telnyx_openai_realtime_bridge_disabled",
        timestamp: new Date().toISOString(),
      }),
    );
    return;
  }

  let startTelnyxRealtimeBridgeServer: () => Promise<void>;
  try {
    const mod = await import("@/lib/voice/telnyx/openai-realtime-bridge/ws-server");
    startTelnyxRealtimeBridgeServer = mod.startTelnyxRealtimeBridgeServer;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        service: "transovo-web",
        event: "telnyx_openai_realtime_bridge_module_missing",
        message,
        hint: "Voice V3 Basic does not use the media bridge; unset VOICE_V2_OPENAI_REALTIME_BRIDGE or restore ws-server.ts",
        timestamp: new Date().toISOString(),
      }),
    );
    process.exit(0);
  }

  await startTelnyxRealtimeBridgeServer();
}

main().catch((err) => {
  console.error("[realtime-bridge-listener] failed", err);
  process.exit(1);
});
