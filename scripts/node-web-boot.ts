/**
 * Node.js web server boot — runs OUTSIDE the Next instrumentation webpack graph.
 *
 * Invoked from scripts/start-production.mjs before the Next standalone server starts.
 * Do NOT import this from src/instrumentation.ts (webpack would traverse Twilio/web-push).
 */
import { getMediaBackendMode } from "@/lib/voice/media-backend";

export async function registerNodeWebBoot(): Promise<void> {
  const mediaBackendMode = getMediaBackendMode();
  console.log(
    JSON.stringify({
      service: "transovo-web",
      event: "web_boot_started",
      mediaBackendMode,
      source: "scripts/node-web-boot",
      timestamp: new Date().toISOString(),
    }),
  );

  const { voiceRuntimeInternalSecret } = await import(
    "@/lib/voice/python-runtime-bridge/auth"
  );
  if (!voiceRuntimeInternalSecret()) {
    console.warn(
      JSON.stringify({
        service: "transovo-web",
        event: "internal_voice_api_secret_missing",
        timestamp: new Date().toISOString(),
        hint: "Set TRANSOVO_INTERNAL_API_KEY so transovo-voice can call /api/internal/voice-runtime",
      }),
    );
  }

  if (process.env.ENABLE_INPROCESS_VOICE_RUNTIME === "1") {
    const { startInProcessVoiceRuntime } = await import(
      "@/lib/voice/inprocess-voice-runtime"
    );
    await startInProcessVoiceRuntime();
  }

  const { bootstrapOutboundRealtimeTest } = await import(
    "@/lib/voice/outbound/outbound-boot"
  );
  void bootstrapOutboundRealtimeTest().catch((err) => {
    console.warn("[node-web-boot] outbound boot failed", err);
  });

  const { bootstrapFrontDeskRealtimeTest } = await import(
    "@/lib/voice/frontdesk/frontdesk-boot"
  );
  void bootstrapFrontDeskRealtimeTest().catch((err) => {
    console.warn("[node-web-boot] frontdesk boot failed", err);
  });

  const { bootstrapRealEstateFrontDesk } = await import(
    "@/lib/voice/real-estate/bootstrap"
  );
  void bootstrapRealEstateFrontDesk().catch((err) => {
    console.warn("[node-web-boot] re-frontdesk boot failed", err);
  });

  const { bootstrapRealtorVerification } = await import("@/lib/realtor/boot-verification");
  void bootstrapRealtorVerification().catch((err) => {
    console.warn("[node-web-boot] realtor verification boot failed", err);
  });

  const { scheduleOutboundAutoSmokeCall } = await import(
    "@/lib/voice/outbound/auto-smoke"
  );
  scheduleOutboundAutoSmokeCall();
}

const isMain =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("node-web-boot.ts") ||
    process.argv[1].endsWith("node-web-boot.mjs"));

if (isMain) {
  registerNodeWebBoot().catch((err) => {
    console.error("[node-web-boot] failed", err);
    process.exit(1);
  });
}
