declare global {
  // eslint-disable-next-line no-var
  var __transovoFrontDeskRealtimeBootstrapped: boolean | undefined;
}

export function isFrontDeskRealtimeTestEnabled(): boolean {
  return process.env.FRONTDESK_REALTIME_TEST?.trim() === "1";
}

/**
 * On deploy: when FRONTDESK_REALTIME_TEST=1, upgrade the inbound frontdesk agent
 * to OpenAI Realtime (same VAD/model/voice env as outbound).
 */
export async function bootstrapFrontDeskRealtimeTest(): Promise<void> {
  if (!isFrontDeskRealtimeTestEnabled()) return;
  if (globalThis.__transovoFrontDeskRealtimeBootstrapped) return;
  globalThis.__transovoFrontDeskRealtimeBootstrapped = true;

  if (!process.env.DATABASE_URL?.trim()) {
    console.warn("[frontdesk-realtime] skipping ensure — DATABASE_URL missing");
    return;
  }

  try {
    const { ensureFrontDeskRealtimeAgent } = await import("./ensure-realtime-agent");
    const result = await ensureFrontDeskRealtimeAgent();
    console.log(
      JSON.stringify({
        source: "transovo-frontdesk-boot",
        event: "frontdesk_realtime_ready",
        ...result,
      }),
    );
  } catch (err) {
    console.error(
      "[frontdesk-realtime] ensure failed:",
      err instanceof Error ? err.message : String(err),
    );
  }
}
