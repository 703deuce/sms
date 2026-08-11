declare global {
  // eslint-disable-next-line no-var
  var __transovoOutboundAutoSmokeScheduled: boolean | undefined;
}

import { isOutboundRealtimeTestEnabled } from "./outbound-boot";
import { resolveOutboundQualificationAgentId } from "./trigger-qualification-call";

const AUTO_SMOKE_DELAY_MS = 45_000;

export function scheduleOutboundAutoSmokeCall(): void {
  if (process.env.OUTBOUND_AUTO_SMOKE_CALL !== "1") return;
  if (globalThis.__transovoOutboundAutoSmokeScheduled) return;
  globalThis.__transovoOutboundAutoSmokeScheduled = true;

  const destinationPhone = process.env.OUTBOUND_TEST_PHONE?.trim();
  if (!destinationPhone) {
    console.warn("[outbound-smoke] OUTBOUND_AUTO_SMOKE_CALL=1 but OUTBOUND_TEST_PHONE is missing");
    return;
  }

  const workspaceId = process.env.WORKSPACE_ID?.trim() || "ws_1";
  const explicitAgentId = process.env.OUTBOUND_SMOKE_AGENT_ID?.trim() || undefined;
  const smokeVoice = process.env.OUTBOUND_AUTO_SMOKE_VOICE?.trim() || undefined;

  if (isOutboundRealtimeTestEnabled() && explicitAgentId) {
    console.warn(
      `[outbound-smoke] OUTBOUND_SMOKE_AGENT_ID=${explicitAgentId} overrides realtime test clone — remove it to force realtime`,
    );
  }

  console.log(
    JSON.stringify({
      source: "outbound-smoke",
      event: "auto_smoke_scheduled",
      destinationPhone,
      delaySec: AUTO_SMOKE_DELAY_MS / 1000,
      realtimeTest: isOutboundRealtimeTestEnabled(),
      explicitAgentId: explicitAgentId || null,
      realtimeVoice: smokeVoice || process.env.VOICE_REALTIME_VOICE?.trim() || null,
    }),
  );

  setTimeout(() => {
    void (async () => {
      try {
        const agentId = await resolveOutboundQualificationAgentId({
          workspaceId,
          agentId: explicitAgentId,
        });

        const { triggerOutboundQualificationCall } = await import("./trigger-qualification-call");
        const result = await triggerOutboundQualificationCall({
          workspaceId,
          agentId,
          destinationPhone,
          triggerSource: "auto_boot_smoke",
          triggerReason: "Automatic post-deploy outbound qualification smoke",
          requireTestModeEnv: false,
          realtimeVoice: smokeVoice,
        });
        console.log(
          JSON.stringify({
            source: "outbound-smoke",
            event: "auto_dial_started",
            agentId,
            callId: result.callId,
            status: result.status,
            roomName: result.roomName,
            realtimeVoice: smokeVoice || null,
          }),
        );
      } catch (err) {
        console.error(
          "[outbound-smoke] auto dial failed:",
          err instanceof Error ? err.message : String(err),
        );
      }
    })();
  }, AUTO_SMOKE_DELAY_MS);
}
