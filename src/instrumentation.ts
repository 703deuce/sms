/**
 * Next.js server boot hook — run job processing in the web container.
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { getMediaBackendMode } = await import("@/lib/voice/media-backend");
  const mediaBackendMode = getMediaBackendMode();
  console.log(
    JSON.stringify({
      service: "transovo-web",
      event: "web_boot_started",
      mediaBackendMode,
      timestamp: new Date().toISOString(),
    }),
  );

  const { startInProcessWorker } = await import("@/lib/jobs/inprocess-worker");
  await startInProcessWorker();

  void (async () => {
    try {
      const { resolvePlatformDemoOwnerWorkspaceId } = await import(
        "@/lib/mctb/onboarding/platform-demo"
      );
      const { reconcileCriticalMessagingSendState } = await import(
        "@/lib/messaging/reconcile-send-state"
      );
      const ownerId = await resolvePlatformDemoOwnerWorkspaceId();
      const ids = ownerId ? [ownerId] : [];
      const healed = await reconcileCriticalMessagingSendState(ids);
      if (healed > 0) {
        console.log(
          JSON.stringify({
            service: "transovo-web",
            event: "messaging_send_state_boot_reconcile",
            healed,
            timestamp: new Date().toISOString(),
          }),
        );
      }
    } catch (err) {
      console.warn("[instrumentation] messaging send-state reconcile failed", err);
    }
  })();

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
  void bootstrapOutboundRealtimeTest().catch((err) => {
    console.warn("[instrumentation] outbound boot failed", err);
  });
  const { bootstrapFrontDeskRealtimeTest } = await import(
    "@/lib/voice/frontdesk/frontdesk-boot"
  );
  void bootstrapFrontDeskRealtimeTest().catch((err) => {
    console.warn("[instrumentation] frontdesk boot failed", err);
  });
  const { bootstrapRealEstateFrontDesk } = await import(
    "@/lib/voice/real-estate/bootstrap"
  );
  void bootstrapRealEstateFrontDesk().catch((err) => {
    console.warn("[instrumentation] re-frontdesk boot failed", err);
  });
  const { bootstrapRealtorVerification } = await import("@/lib/realtor/boot-verification");
  void bootstrapRealtorVerification().catch((err) => {
    console.warn("[instrumentation] realtor verification boot failed", err);
  });
  const { scheduleOutboundAutoSmokeCall } = await import(
    "@/lib/voice/outbound/auto-smoke"
  );
  scheduleOutboundAutoSmokeCall();
}
