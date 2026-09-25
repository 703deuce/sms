/**
 * Voice API / UI wiring audit (no live Telnyx required).
 * Run: npm run test:voice-audit
 */
import { getPrisma } from "../src/lib/db";
import { createVoiceAgent, publishVoiceAgent, updateVoiceAgentDraft } from "../src/lib/voice/agent-service";
import { initiateOutboundCall, completeMockCall } from "../src/lib/voice/call-service";
import { enrollCampaignAudience, startCampaign, pauseCampaign } from "../src/lib/voice/campaigns";
import { getAvailability, bookAppointment } from "../src/lib/voice/calendar/booking";
import { loadConversations } from "../src/lib/voice/conversations";
import { processKnowledgeSource, searchKnowledge } from "../src/lib/voice/knowledge-processor";
import { loadVoiceAnalytics, analyticsToCsv } from "../src/lib/voice/analytics";
import { createRecordingAccessToken, verifyRecordingAccessToken } from "../src/lib/voice/recordings";
import { simulateRouting } from "../src/lib/voice/routing";
import { executeVoiceTool } from "../src/lib/voice/tools/executor";
import { loadVoiceOverviewSummary } from "../src/lib/voice/overview-summary";

const failures: string[] = [];
function ok(label: string) { console.log(`✓ ${label}`); }
function fail(label: string, detail?: string) {
  failures.push(detail ? `${label}: ${detail}` : label);
  console.log(`✗ ${label}${detail ? `: ${detail}` : ""}`);
}

async function main() {
  delete process.env.TELNYX_API_KEY;
  delete process.env.TELNYX_CONNECTION_ID;

  const prisma = getPrisma();
  const workspace = await prisma.workspace.create({
    data: { name: "Voice Audit", slug: `voice-audit-${Date.now()}` },
  });
  const ws = workspace.id;

  const pn = await prisma.phoneNumber.create({
    data: { workspaceId: ws, e164: "+14155550300", type: "Local", status: "Active" },
  });

  const agent = await createVoiceAgent(ws, { name: "Audit Agent", agentType: "custom" });
  await updateVoiceAgentDraft(ws, agent.id, { phoneNumberId: pn.id });
  await publishVoiceAgent(ws, agent.id);
  ok("agent create + publish");

  const overview = await loadVoiceOverviewSummary(ws);
  if (overview.data.mode === "active" || overview.data.mode === "first_run") ok("overview load");
  else fail("overview load");

  await prisma.voiceRoutingRule.create({
    data: {
      workspaceId: ws,
      name: "Test rule",
      priority: 0,
      conditions: {},
      actions: { type: "ai_answer", agentId: agent.id },
    },
  });
  const routing = await simulateRouting(ws, { fromE164: "+14155550111", toE164: pn.e164 });
  if (routing.decision.action) ok("routing simulate");
  else fail("routing simulate");

  const kb = await prisma.voiceKnowledgeBase.create({
    data: { workspaceId: ws, name: "Audit KB", status: "active" },
  });
  const src = await prisma.voiceKnowledgeSource.create({
    data: {
      workspaceId: ws,
      knowledgeBaseId: kb.id,
      name: "t",
      sourceType: "text",
      contentText: "Support hours are 9 to 5 weekdays.",
      status: "pending",
    },
  });
  await processKnowledgeSource(src.id);
  const hits = await searchKnowledge(ws, kb.id, "weekdays");
  if (hits.length) ok("knowledge process + search");
  else fail("knowledge");

  const bookTool = await prisma.voiceTool.create({
    data: {
      workspaceId: ws,
      name: "Book",
      toolType: "book_appointment",
      config: {},
      status: "active",
    },
  });
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  tomorrow.setHours(11, 0, 0, 0);
  await executeVoiceTool({
    workspaceId: ws,
    toolId: bookTool.id,
    input: { startsAt: tomorrow.toISOString(), phone: "+14155550122" },
  });
  ok("tool book_appointment");

  const avail = await getAvailability(ws, { daysAhead: 3 });
  if (avail.slots.length) ok("calendar availability");
  else fail("calendar availability");

  await bookAppointment(ws, {
    startsAt: avail.slots[0].startsAt,
    phone: "+14155550123",
    serviceName: "Audit",
  });
  ok("calendar book");

  const campaign = await prisma.voiceCampaign.create({
    data: { workspaceId: ws, name: "Audit camp", agentId: agent.id, status: "DRAFT" },
  });
  const contact = await prisma.contact.create({
    data: { workspaceId: ws, phone: "+14155550901", status: "SUBSCRIBED" },
  });
  const list = await prisma.contactList.create({ data: { workspaceId: ws, name: "audit" } });
  await prisma.contactListMember.create({ data: { listId: list.id, contactId: contact.id } });
  await enrollCampaignAudience(ws, campaign.id, { listId: list.id });
  await startCampaign(ws, campaign.id);
  await pauseCampaign(ws, campaign.id);
  ok("campaign enroll start pause");

  const { call } = await initiateOutboundCall({
    workspaceId: ws,
    agentId: agent.id,
    toPhone: "+14155550902",
    isTest: true,
  });
  if (call.id) ok("test outbound call (draft agent allowed)");
  else fail("test outbound");

  await completeMockCall(call.id);
  const completed = await prisma.voiceCall.findUnique({ where: { id: call.id } });
  if (completed?.status === "COMPLETED") ok("mock call complete");
  else fail("mock call complete");

  const { call: prodCall } = await initiateOutboundCall({
    workspaceId: ws,
    agentId: agent.id,
    toPhone: "+14155550903",
    isTest: false,
  });
  await completeMockCall(prodCall.id);

  const convos = await loadConversations(ws);
  if (convos.length >= 1) ok("conversations load");
  else fail("conversations");

  const analytics = await loadVoiceAnalytics(ws, 30);
  const csv = analyticsToCsv(analytics);
  if (csv.includes("total_calls")) ok("analytics + csv");
  else fail("analytics");

  await prisma.voiceComplianceProfile.upsert({
    where: { workspaceId: ws },
    create: { workspaceId: ws, emergencyStop: false, settings: {} },
    update: { emergencyStop: true },
  });
  ok("compliance profile upsert");

  const rec = await prisma.voiceRecording.create({
    data: {
      workspaceId: ws,
      callId: call.id,
      provider: "telnyx",
      status: "ready",
      storageUrl: "https://example.com/rec.mp3",
      channels: 2,
    },
  });
  const { token } = createRecordingAccessToken(rec.id, ws);
  const verified = verifyRecordingAccessToken(token);
  if (verified?.recordingId === rec.id) ok("recording signed URL token");
  else fail("recording token");

  // cleanup
  await prisma.voiceRecording.deleteMany({ where: { workspaceId: ws } });
  await prisma.voiceAppointment.deleteMany({ where: { workspaceId: ws } });
  await prisma.voiceCalendarConnection.deleteMany({ where: { workspaceId: ws } });
  await prisma.voiceTransfer.deleteMany({ where: { workspaceId: ws } });
  await prisma.voiceToolExecution.deleteMany({ where: { workspaceId: ws } });
  await prisma.voiceCampaignContact.deleteMany({ where: { workspaceId: ws } });
  await prisma.voiceKnowledgeSource.deleteMany({ where: { workspaceId: ws } });
  await prisma.voiceKnowledgeBase.deleteMany({ where: { workspaceId: ws } });
  await prisma.voiceRoutingRule.deleteMany({ where: { workspaceId: ws } });
  await prisma.voiceUsageRecord.deleteMany({ where: { workspaceId: ws } });
  await prisma.voiceConversationInsight.deleteMany({ where: { workspaceId: ws } });
  await prisma.voiceTranscript.deleteMany({ where: { workspaceId: ws } });
  await prisma.voiceCallEvent.deleteMany({ where: { workspaceId: ws } });
  await prisma.voiceTestRun.deleteMany({ where: { workspaceId: ws } });
  await prisma.voiceCall.deleteMany({ where: { workspaceId: ws } });
  await prisma.voiceCampaign.deleteMany({ where: { workspaceId: ws } });
  await prisma.voiceTool.deleteMany({ where: { workspaceId: ws } });
  await prisma.voiceAgentVersion.deleteMany({ where: { workspaceId: ws } });
  await prisma.voiceAgent.deleteMany({ where: { workspaceId: ws } });
  await prisma.voiceComplianceProfile.deleteMany({ where: { workspaceId: ws } });
  await prisma.contactListMember.deleteMany({ where: { listId: list.id } });
  await prisma.contactList.delete({ where: { id: list.id } });
  await prisma.contact.delete({ where: { id: contact.id } });
  await prisma.phoneNumber.delete({ where: { id: pn.id } });
  await prisma.workspace.delete({ where: { id: ws } });

  if (failures.length) {
    console.error(`FAILED (${failures.length})`);
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }
  console.log("All voice audit checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
