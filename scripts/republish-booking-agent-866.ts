/**
 * Republish booking agent #2 and stamp dispatch snapshot on +866.
 * Does NOT mutate draft config — publish only.
 *
 * Usage:
 *   npx tsx scripts/republish-booking-agent-866.ts
 */
import { getPrisma } from "@/lib/db";
import { publishVoiceAgent } from "@/lib/voice/agent-service";
import {
  getPythonRuntimeBootstrapSnapshot,
} from "@/lib/voice/python-runtime-bridge/build-bootstrap-snapshot";
import { loadExplicitDispatchForDid } from "@/lib/telephony/provisioning/dispatch-metadata";
import { parseVoiceAgentConfig } from "@/lib/voice/types";

const AGENT_ID = (process.env.REPUBLISH_AGENT_ID || process.env.AGENT_ID || "cmt33t45w6s5i213o34702e2r").trim();
const WORKSPACE_ID = (
  process.env.REPUBLISH_WORKSPACE_ID || "cmt2zyg4l43373s0f146b442h"
).trim();
const TO_E164 = (process.env.TO_E164 || "+18663464256").trim();
const PUBLISHED_BY = (process.env.PUBLISHED_BY || "dispatch_snapshot_republish").trim();

async function main() {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
    select: { id: true, name: true, phoneNumberId: true },
  });
  if (!agent) throw new Error(`Agent not found: ${AGENT_ID}`);

  console.log(`Republishing ${agent.name} (${agent.id})...`);
  const result = await publishVoiceAgent(WORKSPACE_ID, AGENT_ID, PUBLISHED_BY);

  const snapshot = getPythonRuntimeBootstrapSnapshot(
    parseVoiceAgentConfig(result.version.config).advanced as Record<string, unknown>,
  );
  const didDispatch = await loadExplicitDispatchForDid(TO_E164);

  console.log("\n=== REPUBLISH COMPLETE ===");
  console.log(`Version: ${result.version.id} (v${result.version.version})`);
  console.log(`Published config snapshot: ${snapshot ? "YES" : "MISSING"}`);
  console.log(
    `Phone explicitDispatch snapshot: ${
      didDispatch?.pythonRuntimeBootstrapSnapshot ? "YES" : "MISSING"
    }`,
  );
  if (snapshot) {
    console.log(`Template: ${snapshot.agentTemplate}`);
    console.log(`Business: ${snapshot.businessName}`);
  }
  if (didDispatch) {
    console.log(`DID routes to agent: ${didDispatch.agentId}`);
    console.log(`Dispatch source: ${didDispatch.dispatchSource}`);
  }

  if (!snapshot) throw new Error("Published version missing pythonRuntimeBootstrapSnapshot");
  if (!didDispatch?.pythonRuntimeBootstrapSnapshot) {
    throw new Error("Phone explicitDispatch missing pythonRuntimeBootstrapSnapshot after publish");
  }
  if (didDispatch.agentId !== AGENT_ID) {
    throw new Error(`DID routes to ${didDispatch.agentId}, expected ${AGENT_ID}`);
  }

  console.log("\nReady for test call — expect bootstrapPath: dispatch_snapshot");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
