/**
 * Canonical Amy +866 LiveKit setup (beginning → end).
 *
 * PSTN → Telnyx FQDN (Transovo LiveKit Inbound)
 *     → LiveKit SIP ingress from LIVEKIT_SIP_URI / LIVEKIT_URL project
 *     → inbound trunk (transovo-telnyx-inbound)
 *     → dispatch rule (transovo-inbound-dispatch → worker from LIVEKIT_AGENT_NAME)
 *     → Amy agent bootstrap (cmshz2lc25c622c4i58303501)
 *
 * Run:
 *   VOICE_RUNTIME_PROVIDER=livekit NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/setup-amy-866-livekit-end-to-end.ts
 */
import { pruneStaleTelnyxFqdns } from "../src/lib/telephony/provisioning/telnyx/sip-connection";
import { verifyNumberRouting } from "../src/lib/telephony/provisioning";

const WORKSPACE_ID = (process.env.WORKSPACE_ID || "ws_1").trim();
const AMY_AGENT_ID = (process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501").trim();
const PHONE_866_ID = (process.env.PHONE_866_ID || "cmsc3numa1j17084g391t2z5l").trim();

async function runStep(label: string, fn: () => Promise<void>) {
  console.log(`\n=== ${label} ===`);
  await fn();
}

async function main() {
  process.env.VOICE_RUNTIME_PROVIDER = "livekit";

  await runStep("1) Prune stale Telnyx FQDNs (wrong LiveKit projects)", async () => {
    const pruned = await pruneStaleTelnyxFqdns();
    console.log(JSON.stringify(pruned, null, 2));
  });

  await runStep("2) Activate home_service_dispatcher workflow on Amy", async () => {
    const { persistVoiceWorkflowDefinition } = await import(
      "../src/lib/voice/workflow-runtime/persistence.ts"
    );
    const { HOME_SERVICE_DISPATCHER_WORKFLOW_V1 } = await import(
      "../src/lib/voice/workflow-runtime/definitions/home-service-dispatcher.ts"
    );
    const { setActiveWorkflowForAgent } = await import(
      "../src/lib/voice/workflow-runtime/loader.ts"
    );
    const ref = await persistVoiceWorkflowDefinition({
      workspaceId: WORKSPACE_ID,
      agentId: AMY_AGENT_ID,
      definition: HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
      setActive: true,
    });
    setActiveWorkflowForAgent(AMY_AGENT_ID, ref);
    console.log({ workflowId: ref.workflowId, version: ref.version });
  });

  await runStep("3) Provision Amy on +18663464256 (Telnyx FQDN + LiveKit trunk/dispatch)", async () => {
    const { execSync } = await import("node:child_process");
    execSync("npx tsx scripts/provision-amy-866-livekit.mjs", {
      stdio: "inherit",
      env: { ...process.env, VOICE_RUNTIME_PROVIDER: "livekit" },
    });
  });

  await runStep("4) Verify routing", async () => {
    const verify = await verifyNumberRouting({
      workspaceId: WORKSPACE_ID,
      phoneNumberId: PHONE_866_ID,
    });
    console.log(JSON.stringify(verify, null, 2));
    if (!verify.ok) process.exit(1);
  });

  console.log("\n=== AMY LIVEKIT SETUP COMPLETE ===");
  console.log("Call +1 (866) 346-4256 — Amy should answer.");
  console.log("Coolify must have matching LIVEKIT_* on transovo-web AND transovo-voice:");
  console.log("  MEDIA_BACKEND_MODE=livekit_cloud");
  console.log("  LIVEKIT_URL / LIVEKIT_SIP_URI / LIVEKIT_API_KEY / LIVEKIT_API_SECRET (same project)");
  console.log("  LIVEKIT_AGENT_NAME (worker dispatch target)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
