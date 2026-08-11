/**
 * Next.js server boot hook — run job processing in the web container.
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startInProcessWorker } = await import("@/lib/jobs/inprocess-worker");
  await startInProcessWorker();
  const { startInProcessVoiceRuntime } = await import(
    "@/lib/voice/inprocess-voice-runtime"
  );
  await startInProcessVoiceRuntime();
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
