/**
 * Extended voice platform tests (routing, tools SSRF, campaigns, knowledge, permissions, transfers).
 * Run: npm run test:voice-full
 */
import { getPrisma } from "../src/lib/db";
import { createVoiceAgent } from "../src/lib/voice/agent-service";
import { initiateOutboundCall } from "../src/lib/voice/call-service";
import { enrollCampaignAudience, startCampaign, pauseCampaign } from "../src/lib/voice/campaigns";
import { processKnowledgeSource, searchKnowledge } from "../src/lib/voice/knowledge-processor";
import { canVoiceAction } from "../src/lib/voice/permissions";
import { simulateRouting } from "../src/lib/voice/routing";
import { initiateTransfer } from "../src/lib/voice/transfers";
import { assertSafeWebhookUrl } from "../src/lib/voice/url-safety";
import { executeVoiceTool } from "../src/lib/voice/tools/executor";

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
    data: { name: "Voice Full", slug: `voice-full-${Date.now()}` },
  });
  const workspaceId = workspace.id;

  const user = await prisma.user.create({
    data: {
      email: `voice-full-${Date.now()}@test.local`,
      passwordHash: "x",
      name: "Voice Full",
    },
  });
  await prisma.membership.create({
    data: { workspaceId, userId: user.id, role: "OWNER" },
  });

  // Permissions matrix
  if (canVoiceAction("OWNER", "start_campaign")) ok("OWNER can start_campaign");
  else fail("OWNER permissions");
  if (!canVoiceAction("READ_ONLY", "start_campaign")) ok("READ_ONLY blocked from start_campaign");
  else fail("READ_ONLY permissions");

  // SSRF guard
  try {
    await assertSafeWebhookUrl("http://127.0.0.1/hook");
    fail("SSRF blocks localhost");
  } catch {
    ok("SSRF blocks localhost");
  }
  try {
    await assertSafeWebhookUrl("https://example.com/hook");
    ok("SSRF allows public https");
  } catch (e) {
    fail("SSRF public https", String(e));
  }

  // Routing
  await prisma.voiceRoutingRule.create({
    data: {
      workspaceId,
      name: "After hours hangup",
      priority: 0,
      conditions: { businessHoursOnly: false },
      actions: { type: "hangup" },
    },
  });
  const sim = await simulateRouting(workspaceId, {
    fromE164: "+14155550101",
    toE164: "+14155550200",
  });
  if (sim.decision.action) ok("routing simulation");
  else fail("routing simulation");

  const pn = await prisma.phoneNumber.create({
    data: { workspaceId, e164: "+14155550201", type: "Local", status: "Active" },
  });
  const agent = await createVoiceAgent(workspaceId, { name: "Full Agent", agentType: "lead_qualification" });
  await prisma.voiceAgent.update({
    where: { id: agent.id },
    data: { phoneNumberId: pn.id, status: "ACTIVE" },
  });

  // Knowledge
  const kb = await prisma.voiceKnowledgeBase.create({
    data: { workspaceId, name: "Test KB", status: "active" },
  });
  const source = await prisma.voiceKnowledgeSource.create({
    data: {
      workspaceId,
      knowledgeBaseId: kb.id,
      name: "hours",
      sourceType: "text",
      contentText: "We are open 9 to 5 on weekdays.",
      status: "pending",
    },
  });
  await processKnowledgeSource(source.id);
  const hits = await searchKnowledge(workspaceId, kb.id, "weekdays");
  if (hits.length) ok("knowledge search");
  else fail("knowledge search");

  // Tool execution (booking — no external SMS gate)
  const bookTool = await prisma.voiceTool.create({
    data: {
      workspaceId,
      name: "Test Book",
      toolType: "book_appointment",
      config: { serviceName: "Appointment" },
      status: "active",
    },
  });
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  try {
    await executeVoiceTool({
      workspaceId,
      toolId: bookTool.id,
      input: { startsAt: tomorrow.toISOString(), phone: "+14155550199" },
    });
    ok("tool execute book_appointment");
  } catch (e) {
    fail("tool execute book_appointment", String(e));
  }

  // Campaign enroll / start / pause
  const campaign = await prisma.voiceCampaign.create({
    data: {
      workspaceId,
      name: "Full campaign",
      agentId: agent.id,
      status: "DRAFT",
    },
  });
  const contact = await prisma.contact.create({
    data: { workspaceId, phone: "+14155550999", status: "SUBSCRIBED" },
  });
  const list = await prisma.contactList.create({
    data: { workspaceId, name: "Voice full list" },
  });
  await prisma.contactListMember.create({ data: { listId: list.id, contactId: contact.id } });
  const enroll = await enrollCampaignAudience(workspaceId, campaign.id, { listId: list.id });
  if (enroll.enrolled >= 1) ok("campaign enroll from list");
  else fail("campaign enroll");

  await startCampaign(workspaceId, campaign.id);
  const running = await prisma.voiceCampaign.findUnique({ where: { id: campaign.id } });
  if (running?.status === "RUNNING") ok("campaign start");
  else fail("campaign start");

  await pauseCampaign(workspaceId, campaign.id);
  const paused = await prisma.voiceCampaign.findUnique({ where: { id: campaign.id } });
  if (paused?.status === "PAUSED") ok("campaign pause");
  else fail("campaign pause");

  // Transfer mock
  const { call } = await initiateOutboundCall({
    workspaceId,
    agentId: agent.id,
    toPhone: "+14155550888",
    isTest: true,
  });
  await prisma.voiceCall.update({
    where: { id: call.id },
    data: { telnyxCallControlId: "mock_transfer", status: "IN_PROGRESS" },
  });
  const tr = await initiateTransfer({
    workspaceId,
    callId: call.id,
    destination: "+14155550777",
    transferType: "cold_transfer",
  });
  if (tr.transferId) ok("cold transfer mock");
  else fail("cold transfer");

  // Cleanup
  await prisma.voiceTransfer.deleteMany({ where: { workspaceId } });
  await prisma.voiceToolExecution.deleteMany({ where: { workspaceId } });
  await prisma.voiceCampaignContact.deleteMany({ where: { workspaceId } });
  await prisma.voiceKnowledgeSource.deleteMany({ where: { workspaceId } });
  await prisma.voiceKnowledgeBase.deleteMany({ where: { workspaceId } });
  await prisma.voiceRoutingRule.deleteMany({ where: { workspaceId } });
  await prisma.voiceUsageRecord.deleteMany({ where: { workspaceId } });
  await prisma.voiceTranscript.deleteMany({ where: { workspaceId } });
  await prisma.voiceCallEvent.deleteMany({ where: { workspaceId } });
  await prisma.voiceCall.deleteMany({ where: { workspaceId } });
  await prisma.voiceCampaign.deleteMany({ where: { workspaceId } });
  await prisma.voiceTool.deleteMany({ where: { workspaceId } });
  await prisma.voiceAgentVersion.deleteMany({ where: { workspaceId } });
  await prisma.voiceAgent.deleteMany({ where: { workspaceId } });
  await prisma.contactListMember.deleteMany({ where: { listId: list.id } });
  await prisma.contactList.delete({ where: { id: list.id } });
  await prisma.contact.delete({ where: { id: contact.id } });
  await prisma.phoneNumber.delete({ where: { id: pn.id } });
  await prisma.membership.deleteMany({ where: { workspaceId } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.workspace.delete({ where: { id: workspaceId } });

  if (failures.length) {
    console.error(`FAILED (${failures.length})`);
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }
  console.log("All voice full checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
