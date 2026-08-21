/**
 * Sync LiveKit per-DID dispatch rule with embedded runtime snapshot (zero-HTTP bootstrap).
 *
 * Usage:
 *   REPUBLISH_WORKSPACE_ID=cmt2zyg4l43373s0f146b442h npx tsx scripts/sync-livekit-dispatch-snapshot-866.ts
 */
import assert from "node:assert/strict";
import { getPrisma } from "@/lib/db";
import { ensureNumberProvisioned } from "@/lib/telephony/provisioning";
import {
  buildLiveKitAgentJobMetadata,
  findDidDispatchRuleByName,
} from "@/lib/telephony/provisioning/livekit/dispatch-snapshot-sync";
import { loadExplicitDispatchForDid } from "@/lib/telephony/provisioning/dispatch-metadata";
import { PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY } from "@/lib/voice/python-runtime-bridge/build-bootstrap-snapshot";

const AGENT_ID = (process.env.REPUBLISH_AGENT_ID || process.env.AGENT_ID || "cmt33t45w6s5i213o34702e2r").trim();
const WORKSPACE_ID = (
  process.env.REPUBLISH_WORKSPACE_ID || "cmt2zyg4l43373s0f146b442h"
).trim();
const TO_E164 = (process.env.TO_E164 || "+18663464256").trim();

async function main() {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
    select: { id: true, name: true, phoneNumberId: true, publishedVersionId: true },
  });
  if (!agent?.phoneNumberId) throw new Error(`Agent ${AGENT_ID} has no phone number`);

  const didDispatch = await loadExplicitDispatchForDid(TO_E164);
  assert.ok(didDispatch?.pythonRuntimeBootstrapSnapshot, "Phone explicitDispatch snapshot missing");

  console.log(`Syncing LiveKit did dispatch snapshot for ${TO_E164} (${agent.name})...`);
  const result = await ensureNumberProvisioned({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: agent.phoneNumberId,
    agentId: AGENT_ID,
    publishedVersionId: agent.publishedVersionId,
    routingMode: "livekit_sip",
  });
  if (!result.ok) throw new Error(result.error || "Provision failed");

  const rule = await findDidDispatchRuleByName(TO_E164);
  assert.ok(rule?.sipDispatchRuleId, "LiveKit did dispatch rule not found after sync");

  const agentMetadata = rule?.roomConfig?.agents?.[0]?.metadata || "";
  assert.ok(
    agentMetadata.includes(PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY),
    "LiveKit agent job metadata missing pythonRuntimeBootstrapSnapshot",
  );

  const parsed = JSON.parse(agentMetadata) as ReturnType<typeof buildLiveKitAgentJobMetadata>;
  assert.equal(parsed.resolve, "embedded_dispatch_snapshot");
  assert.equal(parsed.agentId, AGENT_ID);

  console.log("\n=== LIVEKIT DISPATCH SNAPSHOT SYNC OK ===");
  console.log(`Rule: ${rule?.name} (${rule?.sipDispatchRuleId})`);
  console.log(`Provision did rule id: ${result.provision.livekitDidDispatchRuleId || "none"}`);
  console.log(`Agent template: ${parsed.agentTemplate}`);
  console.log("\nReady for test call — expect:");
  console.log("  bootstrapPath: dispatch_local");
  console.log("  bootstrapHttpRequests: 0");
  console.log("  dispatchResolveMs: ~0-5ms");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
