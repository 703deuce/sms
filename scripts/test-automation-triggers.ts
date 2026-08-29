/**
 * Automation trigger + AI reply sequencing integration tests.
 * Uses approved test phones only (571-477-6175, 703-816-6017).
 *
 * Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-automation-triggers.ts
 */
import assert from "node:assert/strict";
import { getPrisma } from "../src/lib/db";
import { delayToMs, parseDripSteps } from "../src/lib/drip-campaigns/types";
import { summarizeDeliveryStatuses } from "../src/lib/automate/delivery-stats";
import {
  contactAddedAutomationsAlreadyFired,
  fireContactAddedAutomations,
  shouldRunContactAddedAutomations,
} from "../src/lib/automate/contact-added-triggers";
import { createAutoReply } from "../src/lib/auto-replies/service";
import { dispatchAutoReplies } from "../src/lib/auto-replies/dispatch";
import { createDripCampaign } from "../src/lib/drip-campaigns/service";
import { triggerDripCampaigns } from "../src/lib/drip-campaigns/engine";
import { processAiReplyRespond } from "../src/lib/ai-replies/engine";
import { createAiReply } from "../src/lib/ai-replies/service";

process.env.APP_URL ||= "http://localhost:3000";
process.env.INTEGRATION_SECRET_KEY ||= "test-integration-secret-key";
delete process.env.TWILIO_MODE;
delete process.env.MESSAGING_ADAPTER;

/** Approved beta test numbers — do not substitute other phones. */
const TEST_PHONE_A = "+15714776175"; // pragma: allowlist secret
const TEST_PHONE_B = "+17038166017"; // pragma: allowlist secret
const APPROVED = new Set([TEST_PHONE_A, TEST_PHONE_B]);

const failures: string[] = [];
function ok(label: string) {
  console.log(`✓ ${label}`);
}
function fail(label: string, detail?: string) {
  failures.push(detail ? `${label}: ${detail}` : label);
  console.log(`✗ ${label}${detail ? `: ${detail}` : ""}`);
}

async function setupMockMessaging(workspaceId: string, fromE164: string) {
  const prisma = getPrisma();
  await prisma.messagingRegistration.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      overallStatus: "ready",
      messagingEnabled: true,
      paused: false,
      phoneAttached: true,
      phoneE164: fromE164,
      phoneSid: "PN_MOCK_TRIGGERS",
      brandStatus: "approved",
      campaignStatus: "approved",
      messagingServiceSid: "MG_MOCK_TRIGGERS",
      messagingProvider: "mock",
    },
    update: {
      overallStatus: "ready",
      messagingEnabled: true,
      paused: false,
      phoneAttached: true,
      phoneE164: fromE164,
      brandStatus: "approved",
      campaignStatus: "approved",
      messagingProvider: "mock",
    },
  });

  const existing = await prisma.phoneNumber.findFirst({
    where: { workspaceId, e164: fromE164 },
  });
  if (!existing) {
    await prisma.phoneNumber.create({
      data: {
        workspaceId,
        e164: fromE164,
        type: "local",
        provider: "telnyx",
        status: "Active",
      },
    });
  }
}

async function main() {
  // --- Pure unit checks ---
  const delayedFirst = parseDripSteps([
    { id: "s1", delayAmount: 2, delayUnit: "days", message: "Hello" },
    { id: "s2", delayAmount: 1, delayUnit: "days", message: "Follow up" },
  ]);
  if (delayedFirst.length === 2 && delayToMs(delayedFirst[0]) === 2 * 86_400_000) {
    ok("drip first-message delay honored");
  } else {
    fail("drip first-message delay honored");
  }

  const stats = summarizeDeliveryStatuses(["delivered", "sent", "failed", "queued"]);
  if (stats.sent === 4 && stats.delivered === 2 && stats.failed === 1 && stats.pending === 1) {
    ok("delivery stats aggregation");
  } else {
    fail("delivery stats aggregation", JSON.stringify(stats));
  }

  for (const phone of APPROVED) {
    assert(APPROVED.has(phone), `approved set contains ${phone}`);
  }
  ok("approved test numbers configured");

  assert.equal(shouldRunContactAddedAutomations(null, "manual"), true);
  assert.equal(
    shouldRunContactAddedAutomations(
      { id: "c1", customFields: {}, consentSource: "inbound_sms" },
      "manual",
    ),
    true,
  );
  assert.equal(
    shouldRunContactAddedAutomations(
      { id: "c1", customFields: { contactAddedAutomationsAt: "2026-01-01" }, consentSource: null },
      "manual",
    ),
    false,
  );
  assert.equal(contactAddedAutomationsAlreadyFired({ contactAddedAutomationsAt: "x" }), true);
  ok("contact_added trigger eligibility");

  const prisma = getPrisma();
  const suffix = Date.now();
  const workspace = await prisma.workspace.create({
    data: {
      name: "Automation triggers test",
      slug: `auto-triggers-${suffix}`,
      creditBalanceCents: 1_000_000,
    },
  });
  const workspaceId = workspace.id;
  console.log(`workspace=${workspaceId}`);

  await setupMockMessaging(workspaceId, TEST_PHONE_A);

  await createAutoReply(workspaceId, {
    name: "Welcome on add",
    triggerType: "contact_added",
    message: "Thanks for joining us!",
    status: "active",
    rules: { respectQuietHours: false },
  });

  const drip = await createDripCampaign(workspaceId, {
    name: "Drip on add delayed",
    triggerType: "contact_added",
    status: "active",
    steps: [
      { id: "s1", delayAmount: 2, delayUnit: "days", message: "Day 2 hello" },
      { id: "s2", delayAmount: 0, delayUnit: "immediate", message: "Step 2" },
    ],
  });

  const list = await prisma.contactList.create({
    data: { workspaceId, name: `Trigger list ${suffix}` },
  });

  await createAutoReply(workspaceId, {
    name: "List join welcome",
    triggerType: "list_join",
    triggerConfig: { listId: list.id, listName: list.name },
    message: "You joined the list!",
    status: "active",
    rules: { respectQuietHours: false },
  });

  await createDripCampaign(workspaceId, {
    name: "Drip on list join",
    triggerType: "list_join",
    triggerConfig: { listId: list.id },
    status: "active",
    steps: [{ id: "s1", delayAmount: 0, delayUnit: "immediate", message: "List drip" }],
  });

  // --- New contact → contact_added fires auto-reply + drip enroll ---
  const newContact = await prisma.contact.create({
    data: {
      workspaceId,
      phone: TEST_PHONE_B,
      firstName: "Trigger",
      lastName: "New",
      status: "SUBSCRIBED",
      consentSource: "manual",
      consentDate: new Date(),
    },
  });

  const fired = await fireContactAddedAutomations(workspaceId, newContact.id, {
    fromE164: TEST_PHONE_A,
    consentSource: "manual",
  });

  if (fired.autoReply?.sent) ok("contact_added auto-reply sent for new contact");
  else fail("contact_added auto-reply sent for new contact", JSON.stringify(fired.autoReply));

  if ((fired.dripEnrolled ?? 0) >= 1) ok("contact_added drip enrolled for new contact");
  else fail("contact_added drip enrolled for new contact", `enrolled=${fired.dripEnrolled}`);

  const marked = await prisma.contact.findUnique({
    where: { id: newContact.id },
    select: { customFields: true },
  });
  if (contactAddedAutomationsAlreadyFired(marked?.customFields)) {
    ok("contact_added marks contactAddedAutomationsAt after send");
  } else {
    fail("contact_added marks contactAddedAutomationsAt after send");
  }

  const enrollment = await prisma.dripCampaignEnrollment.findFirst({
    where: { dripCampaignId: drip.id, contactId: newContact.id },
  });
  if (enrollment?.nextRunAt) {
    const expectedMin = Date.now() + 2 * 86_400_000 - 5000;
    const expectedMax = Date.now() + 2 * 86_400_000 + 5000;
    const runAt = enrollment.nextRunAt.getTime();
    if (runAt >= expectedMin && runAt <= expectedMax) {
      ok("drip first step 2-day delay schedules nextRunAt");
    } else {
      fail(
        "drip first step 2-day delay schedules nextRunAt",
        `nextRunAt=${enrollment.nextRunAt.toISOString()}`,
      );
    }
  } else {
    fail("drip enrollment created with nextRunAt");
  }

  const immediateDrip = await createDripCampaign(workspaceId, {
    name: "Immediate drip on add",
    triggerType: "contact_added",
    status: "active",
    steps: [{ id: "s1", delayAmount: 0, delayUnit: "immediate", message: "Instant hello" }],
  });

  const instantEnroll = await triggerDripCampaigns({
    workspaceId,
    contactId: newContact.id,
    triggerType: "contact_added",
  });
  if (instantEnroll >= 1) ok("immediate drip enrolls on contact_added");
  else fail("immediate drip enrolls on contact_added");

  const instantMsg = await prisma.message.findFirst({
    where: {
      workspaceId,
      to: TEST_PHONE_B,
      idempotencyKey: `drip:${immediateDrip.id}:${newContact.id}:0`,
    },
  });
  if (instantMsg) ok("immediate drip sends step 0 without waiting for job worker");
  else fail("immediate drip sends step 0 without waiting for job worker");

  const msgCount = await prisma.message.count({
    where: { workspaceId, to: TEST_PHONE_B },
  });
  if (msgCount >= 1) ok("auto-reply message row created");
  else fail("auto-reply message row created", `count=${msgCount}`);

  // --- Manual add of inbound-created contact fires once (TEST_PHONE_A) ---
  const inboundContact = await prisma.contact.create({
    data: {
      workspaceId,
      phone: TEST_PHONE_A,
      status: "SUBSCRIBED",
      consentSource: "inbound_sms",
    },
  });

  if (shouldRunContactAddedAutomations(inboundContact, "manual")) {
    ok("manual add of inbound contact eligible for contact_added");
  } else {
    fail("manual add of inbound contact eligible for contact_added");
  }

  const manualFire = await fireContactAddedAutomations(workspaceId, inboundContact.id, {
    fromE164: TEST_PHONE_A,
    consentSource: "manual",
  });
  if (manualFire.autoReply?.sent) ok("manual add fires contact_added auto-reply");
  else fail("manual add fires contact_added auto-reply", JSON.stringify(manualFire.autoReply));

  const manualFire2 = await fireContactAddedAutomations(workspaceId, inboundContact.id, {
    fromE164: TEST_PHONE_A,
    consentSource: "manual",
  });
  if (!manualFire2.autoReply?.sent) ok("contact_added does not re-fire after marked");
  else fail("contact_added does not re-fire after marked", JSON.stringify(manualFire2));

  // --- list_join triggers (same TEST_PHONE_A contact) ---
  await prisma.contactListMember.create({
    data: { listId: list.id, contactId: inboundContact.id },
  });

  const listAuto = await dispatchAutoReplies({
    workspaceId,
    contactId: inboundContact.id,
    triggerType: "list_join",
    listId: list.id,
    fromE164: TEST_PHONE_A,
  });
  if (listAuto.sent) ok("list_join auto-reply sent");
  else fail("list_join auto-reply sent", JSON.stringify(listAuto));

  const listDrip = await triggerDripCampaigns({
    workspaceId,
    contactId: inboundContact.id,
    triggerType: "list_join",
    listId: list.id,
  });
  if (listDrip >= 1) ok("list_join drip enrolled");
  else fail("list_join drip enrolled", `count=${listDrip}`);

  // --- AI reply waits for customer reply (no burst) — reuse TEST_PHONE_B contact ---
  const ai = await createAiReply(workspaceId, {
    name: "Keyword AI",
    systemPrompt: "You are helpful.",
    status: "active",
    advanced: { maxRepliesPerContact: 3, replyDelaySec: 0 },
    trigger: { mode: "keywords", keywords: ["pricing"] },
  });

  const conversation = await prisma.conversation.create({
    data: {
      workspaceId,
      contactId: newContact.id,
      fromE164: TEST_PHONE_A,
    },
  });

  const session = await prisma.aiReplySession.create({
    data: {
      aiReplyId: ai.id,
      workspaceId,
      conversationId: conversation.id,
      contactId: newContact.id,
      status: "ai_active",
      messageCount: 1,
    },
  });

  await prisma.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      direction: "inbound",
      body: "pricing",
    },
  });
  await prisma.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      direction: "outbound",
      body: "Here is our pricing info",
      userName: "AI",
    },
  });

  const skipBurst = await processAiReplyRespond({
    aiReplyId: ai.id,
    sessionId: session.id,
    conversationId: conversation.id,
    contactId: newContact.id,
    inboundBody: "pricing",
    fromE164: TEST_PHONE_A,
    inboundDedupeKey: "pricing-dedupe-1",
  });
  if (skipBurst.skipped && skipBurst.reason === "awaiting_customer_reply") {
    ok("AI reply skips when latest message is outbound (no burst)");
  } else {
    fail("AI reply skips when latest message is outbound", JSON.stringify(skipBurst));
  }

  const msgsBefore = await prisma.message.count({
    where: { workspaceId, to: TEST_PHONE_B, idempotencyKey: { startsWith: "ai-reply-send:" } },
  });

  await prisma.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      direction: "inbound",
      body: "tell me more",
    },
  });

  const respond = await processAiReplyRespond({
    aiReplyId: ai.id,
    sessionId: session.id,
    conversationId: conversation.id,
    contactId: newContact.id,
    inboundBody: "tell me more",
    fromE164: TEST_PHONE_A,
    inboundDedupeKey: "tell-me-more-1",
  });
  if (respond.sent) ok("AI reply sends when customer replied again");
  else fail("AI reply sends when customer replied again", JSON.stringify(respond));

  const msgsAfter = await prisma.message.count({
    where: { workspaceId, to: TEST_PHONE_B, idempotencyKey: { startsWith: "ai-reply-send:" } },
  });
  if (msgsAfter === msgsBefore + 1) ok("AI reply sends exactly one message per inbound");
  else fail("AI reply sends exactly one message per inbound", `before=${msgsBefore} after=${msgsAfter}`);

  const dup = await processAiReplyRespond({
    aiReplyId: ai.id,
    sessionId: session.id,
    conversationId: conversation.id,
    contactId: newContact.id,
    inboundBody: "tell me more",
    fromE164: TEST_PHONE_A,
    inboundDedupeKey: "tell-me-more-1",
  });
  const msgsAfterDup = await prisma.message.count({
    where: { workspaceId, to: TEST_PHONE_B, idempotencyKey: { startsWith: "ai-reply-send:" } },
  });
  if (msgsAfterDup === msgsAfter && dup.skipped) ok("AI reply dedupes same inbound (no second send)");
  else fail("AI reply dedupes same inbound", JSON.stringify({ dup, msgsAfterDup, msgsAfter }));

  // Cleanup
  await prisma.workspace.delete({ where: { id: workspaceId } });

  console.log(`\n${failures.length === 0 ? "All automation trigger tests passed" : `${failures.length} failed`}`);
  if (failures.length) {
    console.log(failures.join("\n"));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
