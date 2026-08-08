#!/usr/bin/env node
/**
 * Provision +18663464256 for LiveKit via API (no LiveKit dashboard).
 *
 *   VOICE_RUNTIME_PROVIDER=livekit npx tsx scripts/provision-amy-866-livekit.mjs
 */
const WORKSPACE_ID = (process.env.WORKSPACE_ID || "ws_1").trim();
const AMY_AGENT_ID = (process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501").trim();
const PHONE_866_ID = (process.env.PHONE_866_ID || "cmsc3numa1j17084g391t2z5l").trim();

async function main() {
  process.env.VOICE_RUNTIME_PROVIDER = "livekit";

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const { updateVoiceAgentDraft, publishVoiceAgent } = await import(
    "../src/lib/voice/agent-service.ts"
  );
  const { assignNumberToAgent, verifyNumberRouting } = await import(
    "../src/lib/telephony/provisioning/index.ts"
  );

  const pn = await prisma.phoneNumber.findUnique({ where: { id: PHONE_866_ID } });
  if (!pn) throw new Error("866 phone number not found");

  console.log("\n=== 1) Assign Amy to +18663464256 ===");
  await updateVoiceAgentDraft(WORKSPACE_ID, AMY_AGENT_ID, {
    phoneNumberId: PHONE_866_ID,
    status: "ACTIVE",
  });

  console.log("\n=== 2) Provision Telnyx FQDN + LiveKit trunk/dispatch ===");
  const assigned = await assignNumberToAgent({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: PHONE_866_ID,
    agentId: AMY_AGENT_ID,
    exclusive: true,
  });
  console.log(JSON.stringify(assigned, null, 2));

  console.log("\n=== 3) Publish Amy (LiveKit path) ===");
  const published = await publishVoiceAgent(WORKSPACE_ID, AMY_AGENT_ID, "provision-866-livekit");
  console.log(
    JSON.stringify(
      {
        agent: published.agent.name,
        status: published.agent.status,
        livekitProvision: published.livekitProvision,
      },
      null,
      2,
    ),
  );

  console.log("\n=== 4) Verify routing ===");
  const verify = await verifyNumberRouting({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: PHONE_866_ID,
  });
  console.log(JSON.stringify(verify, null, 2));

  await prisma.$disconnect();
  if (!assigned.ok || !verify.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
