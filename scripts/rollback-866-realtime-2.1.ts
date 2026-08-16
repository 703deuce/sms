/**
 * Roll +18663464256 Amy back to gpt-realtime-2.1 (published version 14).
 *
 *   npx tsx scripts/rollback-866-realtime-2.1.ts
 */
import { getPrisma } from "../src/lib/db";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { syncVoiceAgentPhoneAssignment } from "../src/lib/voice/agent-phone";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const PHONE_E164 = "+18663464256";
const AGENT_ID = process.env.AGENT_ID || "cmsrk6b775h0m3n6o6z693i2l";
const VERSION_14_ID = "cmsrwbdk60n1l3l5p4m0d0q65";
const TARGET_MODEL = "gpt-realtime-2.1";

async function main() {
  const prisma = getPrisma();

  const phone = await prisma.phoneNumber.findFirst({
    where: { e164: PHONE_E164 },
    select: { id: true, workspaceId: true },
  });
  if (!phone) throw new Error(`Phone ${PHONE_E164} not found`);

  const version = await prisma.voiceAgentVersion.findFirst({
    where: { id: VERSION_14_ID, agentId: AGENT_ID, workspaceId: WORKSPACE_ID },
  });
  if (!version) throw new Error(`Version 14 not found (${VERSION_14_ID})`);

  const cfg = parseVoiceAgentConfig(version.config);
  const compiled = (cfg.advanced as Record<string, unknown> | undefined)
    ?.receptionistCompiled as Record<string, unknown> | undefined;
  if (compiled?.realtimeModel !== TARGET_MODEL) {
    throw new Error(`Version 14 model mismatch: ${compiled?.realtimeModel}`);
  }

  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
  });
  if (!agent) throw new Error("Agent not found");

  console.log(`Before: published=${agent.publishedVersionId} status=${agent.status}`);

  const updated = await prisma.voiceAgent.update({
    where: { id: AGENT_ID },
    data: {
      publishedVersionId: VERSION_14_ID,
      draftConfig: version.config as object,
      status: "ACTIVE",
      healthStatus: "ok",
      healthMessage: null,
    },
  });

  await syncVoiceAgentPhoneAssignment({
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
    phoneNumberId: updated.phoneNumberId,
    exclusive: true,
  });

  console.log({
    agent: updated.name,
    status: updated.status,
    publishedVersionId: updated.publishedVersionId,
    version: version.version,
    realtimeModel: compiled?.realtimeModel,
  });
  console.log("OK — +18663464256 rolled back to gpt-realtime-2.1");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
