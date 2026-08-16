/**
 * Next.js server boot hook — run job processing in the web container.
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  console.log(
    JSON.stringify({
      service: "transovo-web",
      event: "web_boot_started",
      timestamp: new Date().toISOString(),
    }),
  );

  const { startInProcessWorker } = await import("@/lib/jobs/inprocess-worker");
  await startInProcessWorker();

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

  // Voice worker runs as separate transovo-voice service (not spawned from web).
  // Local dev: npm run voice-python:start or ENABLE_INPROCESS_VOICE_RUNTIME=1
  if (process.env.ENABLE_INPROCESS_VOICE_RUNTIME === "1") {
    const { startInProcessVoiceRuntime } = await import(
      "@/lib/voice/inprocess-voice-runtime"
    );
    await startInProcessVoiceRuntime();
  }
  const { bootstrapOutboundRealtimeTest } = await import(
    "@/lib/voice/outbound/outbound-boot"
  );
  await bootstrapOutboundRealtimeTest();
  const { bootstrapFrontDeskRealtimeTest } = await import(
    "@/lib/voice/frontdesk/frontdesk-boot"
  );
  await bootstrapFrontDeskRealtimeTest();
  const { bootstrapRealEstateFrontDesk } = await import(
    "@/lib/voice/real-estate/bootstrap"
  );
  await bootstrapRealEstateFrontDesk();
  const { bootstrapRealtorVerification } = await import("@/lib/realtor/boot-verification");
  await bootstrapRealtorVerification();
  const { scheduleOutboundAutoSmokeCall } = await import(
    "@/lib/voice/outbound/auto-smoke"
  );
  scheduleOutboundAutoSmokeCall();
}
