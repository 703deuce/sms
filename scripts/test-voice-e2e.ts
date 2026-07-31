/**
 * Voice E2E tests (mock Telnyx dial path).
 * Run: npx tsx scripts/test-voice-e2e.ts
 */
import { getPrisma } from "../src/lib/db";
import { createVoiceAgent, publishVoiceAgent } from "../src/lib/voice/agent-service";
import { initiateOutboundCall } from "../src/lib/voice/call-service";
import { processPostCall } from "../src/lib/voice/post-call";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";

process.env.APP_URL ||= "http://localhost:3000";
delete process.env.TELNYX_API_KEY;
delete process.env.TELNYX_CONNECTION_ID;

const failures: string[] = [];
function ok(label: string) { console.log(`✓ ${label}`); }
function fail(label: string, detail?: string) {
  failures.push(detail ? `${label}: ${detail}` : label);
  console.log(`✗ ${label}${detail ? `: ${detail}` : ""}`);
}

async function main() {
  const prisma = getPrisma();
  const workspace = await prisma.workspace.create({
    data: { name: "Voice E2E", slug: `voice-e2e-${Date.now()}` },
  });
  const workspaceId = workspace.id;

  const pn = await prisma.phoneNumber.create({
    data: {
      workspaceId,
      e164: "+14155550200",
      type: "Local",
      status: "Active",
    },
  });

  const agent = await createVoiceAgent(workspaceId, {
    name: "E2E Agent",
    agentType: "lead_qualification",
  });
  await prisma.voiceAgent.update({
    where: { id: agent.id },
    data: { phoneNumberId: pn.id, status: "TESTING" },
  });

  const config = parseVoiceAgentConfig(agent.draftConfig);
  if (config.instructions?.system) ok("agent config defaults");

  await publishVoiceAgent(workspaceId, agent.id);
  ok("publish agent");

  const phone = `+1415555${String(Date.now()).slice(-4)}`;
  const { call } = await initiateOutboundCall({
    workspaceId,
    agentId: agent.id,
    toPhone: phone,
    isTest: true,
  });
  if (call.id) ok("outbound call queued");

  // Simulate mock completion worker
  const { completeMockCall } = await import("../src/lib/voice/call-service");
  await completeMockCall(call.id);
  ok("mock call completed");

  const updated = await prisma.voiceCall.findUnique({ where: { id: call.id } });
  if (updated?.status === "COMPLETED") ok("call status completed");

  const transcript = await prisma.voiceTranscript.findFirst({ where: { callId: call.id } });
  if (transcript?.fullText) ok("transcript stored");

  const usage = await prisma.voiceUsageRecord.findFirst({
    where: { workspaceId, callId: call.id },
  });
  if (usage) ok("usage recorded");

  // cleanup
  await prisma.voiceUsageRecord.deleteMany({ where: { workspaceId } });
  await prisma.voiceConversationInsight.deleteMany({ where: { workspaceId } });
  await prisma.voiceTranscript.deleteMany({ where: { workspaceId } });
  await prisma.voiceCallEvent.deleteMany({ where: { workspaceId } });
  await prisma.voiceCall.deleteMany({ where: { workspaceId } });
  await prisma.voiceAgentVersion.deleteMany({ where: { workspaceId } });
  await prisma.voiceAgent.deleteMany({ where: { workspaceId } });
  await prisma.phoneNumber.delete({ where: { id: pn.id } });
  await prisma.workspace.delete({ where: { id: workspaceId } });

  if (failures.length) {
    console.error(`FAILED (${failures.length})`);
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }
  console.log("All voice E2E checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
