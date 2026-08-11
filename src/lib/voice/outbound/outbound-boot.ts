declare global {
  // eslint-disable-next-line no-var
  var __transovoOutboundRealtimeBootstrapped: boolean | undefined;
}

export function isOutboundRealtimeTestEnabled(): boolean {
  return process.env.OUTBOUND_REALTIME_TEST?.trim() === "1";
}

/**
 * On Coolify deploy: when OUTBOUND_REALTIME_TEST=1, provision the realtime clone
 * in the database and wire auto-smoke to it — no manual setup scripts.
 */
export async function bootstrapOutboundRealtimeTest(): Promise<void> {
  if (!isOutboundRealtimeTestEnabled()) return;
  if (globalThis.__transovoOutboundRealtimeBootstrapped) return;
  globalThis.__transovoOutboundRealtimeBootstrapped = true;

  if (!process.env.DATABASE_URL?.trim()) {
    console.warn("[outbound-realtime] skipping clone ensure — DATABASE_URL missing");
    return;
  }

  try {
    const { ensureOutboundRealtimeCloneAgent } = await import("./ensure-realtime-clone-agent");
    const result = await ensureOutboundRealtimeCloneAgent();

    if (!process.env.OUTBOUND_SMOKE_AGENT_ID?.trim()) {
      process.env.OUTBOUND_SMOKE_AGENT_ID = result.agentId;
    } else if (process.env.OUTBOUND_SMOKE_AGENT_ID.trim() !== result.agentId) {
      console.warn(
        `[outbound-realtime] OUTBOUND_SMOKE_AGENT_ID=${process.env.OUTBOUND_SMOKE_AGENT_ID} does not match realtime clone ${result.agentId} — smoke will use the explicit id`,
      );
    }

    console.log(
      JSON.stringify({
        source: "transovo-outbound-boot",
        event: "realtime_clone_ready",
        ...result,
        smokeAgentId: process.env.OUTBOUND_SMOKE_AGENT_ID,
      }),
    );
  } catch (err) {
    console.error(
      "[outbound-realtime] clone ensure failed:",
      err instanceof Error ? err.message : String(err),
    );
  }
}
