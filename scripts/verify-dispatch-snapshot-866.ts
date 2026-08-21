/**
 * Verify booking agent #2 has dispatch snapshot stamped on +866.
 *
 * Usage:
 *   npx tsx scripts/verify-dispatch-snapshot-866.ts
 *
 * Pass criteria before judging call latency:
 *   - explicitDispatch.pythonRuntimeBootstrapSnapshot present
 *   - published version config has pythonRuntimeBootstrapSnapshot
 */
import assert from "node:assert/strict";
import { getPrisma } from "@/lib/db";
import {
  PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY,
  getPythonRuntimeBootstrapSnapshot,
} from "@/lib/voice/python-runtime-bridge/build-bootstrap-snapshot";
import { loadExplicitDispatchForDid } from "@/lib/telephony/provisioning/dispatch-metadata";
import { parseVoiceAgentConfig } from "@/lib/voice/types";

const AGENT_ID = (process.env.AGENT_ID || "cmt33t45w6s5i213o34702e2r").trim();
const TO_E164 = (process.env.TO_E164 || "+18663464256").trim();
const WORKSPACE_ID = (process.env.WORKSPACE_ID || "cmt2zyg4l43373s0f146b442h").trim();

async function main() {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
    select: {
      id: true,
      name: true,
      publishedVersionId: true,
      phoneNumberId: true,
    },
  });
  if (!agent) throw new Error(`Agent not found: ${AGENT_ID}`);

  const version = agent.publishedVersionId
    ? await prisma.voiceAgentVersion.findFirst({
        where: { id: agent.publishedVersionId, workspaceId: WORKSPACE_ID },
        select: { id: true, config: true, version: true },
      })
    : null;

  const publishedSnapshot = version
    ? getPythonRuntimeBootstrapSnapshot(
        parseVoiceAgentConfig(version.config).advanced as Record<string, unknown>,
      )
    : null;

  const didDispatch = await loadExplicitDispatchForDid(TO_E164);

  console.log("=== Dispatch snapshot verification ===");
  console.log(`Agent: ${agent.id} (${agent.name})`);
  console.log(`DID: ${TO_E164}`);
  console.log(`Published version: ${version?.id || "none"} (v${version?.version ?? "?"})`);
  console.log(
    `Published config snapshot: ${publishedSnapshot ? "YES" : "MISSING — republish required"}`,
  );
  console.log(
    `Phone explicitDispatch snapshot: ${
      didDispatch?.pythonRuntimeBootstrapSnapshot ? "YES" : "MISSING — republish/provision required"
    }`,
  );
  if (didDispatch) {
    console.log(`explicitDispatch.agentId: ${didDispatch.agentId}`);
    console.log(`explicitDispatch.publishedVersionId: ${didDispatch.publishedVersionId || "none"}`);
    console.log(`explicitDispatch.dispatchSource: ${didDispatch.dispatchSource || "unknown"}`);
  } else {
    console.log("explicitDispatch: NOT FOUND for DID");
  }

  assert.ok(publishedSnapshot, "Published version missing pythonRuntimeBootstrapSnapshot");
  assert.ok(
    didDispatch?.pythonRuntimeBootstrapSnapshot,
    "Phone explicitDispatch missing pythonRuntimeBootstrapSnapshot",
  );
  assert.equal(didDispatch?.agentId, AGENT_ID, "DID routes to wrong agent");
  assert.equal(
    publishedSnapshot?.agentTemplate,
    didDispatch?.pythonRuntimeBootstrapSnapshot?.agentTemplate,
    "Snapshot template mismatch between published version and phone dispatch",
  );

  console.log("\nPASS — ready for latency test call.");
  console.log("On call, require:");
  console.log("  bootstrapPath: dispatch_snapshot (or snapshot)");
  console.log("  dispatchResolveMs < 1000 (target 200–500ms)");
  console.log(`  NO slow_bootstrap_path_active log`);
}

main().catch((err) => {
  console.error("\nFAIL —", err instanceof Error ? err.message : err);
  process.exit(1);
});
