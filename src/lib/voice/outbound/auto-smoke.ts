declare global {
  // eslint-disable-next-line no-var
  var __transovoOutboundAutoSmokeScheduled: boolean | undefined;
}

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
  const agentId = process.env.OUTBOUND_SMOKE_AGENT_ID?.trim() || undefined;

  console.log(
    `[outbound-smoke] scheduling auto qualification dial to ${destinationPhone} in ${AUTO_SMOKE_DELAY_MS / 1000}s`,
  );

  setTimeout(() => {
    void (async () => {
      try {
        const { triggerOutboundQualificationCall } = await import("./trigger-qualification-call");
        const result = await triggerOutboundQualificationCall({
          workspaceId,
          agentId,
          destinationPhone,
          triggerSource: "auto_boot_smoke",
          triggerReason: "Automatic post-deploy outbound qualification smoke",
          requireTestModeEnv: false,
        });
        console.log("[outbound-smoke] auto dial started", {
          callId: result.callId,
          status: result.status,
          roomName: result.roomName,
        });
      } catch (err) {
        console.error(
          "[outbound-smoke] auto dial failed:",
          err instanceof Error ? err.message : String(err),
        );
      }
    })();
  }, AUTO_SMOKE_DELAY_MS);
}
