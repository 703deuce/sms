/**
 * Platform-sender inbound SMS routing (multi-tenant) — no live Telnyx.
 * Run: cd new-app && npx tsx scripts/test-mctb-platform-inbound-routing.mjs
 */
import assert from "node:assert/strict";
import { createId } from "../lib/supabase/id.ts";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
if (!hasDb) {
  console.log("SKIP: DATABASE_URL not set");
  process.exit(0);
}

const { getPrisma } = await import("../lib/server/db.ts");
const { resolvePlatformInboundReplyFromContexts } = await import(
  "../lib/mctb/messaging/platform-inbound-tenant-resolution.ts"
);
const { claimPlatformSenderAssignment, findActivePlatformSenderAssignments } = await import(
  "../lib/mctb/messaging/platform-sender-assignment.ts"
);
const { dispatchPlatformMctbInboundSms } = await import(
  "../lib/messaging/platform-mctb-inbound-dispatch.ts"
);
const prisma = getPrisma();

// Pure policy: two workspaces in context => ambiguous
{
  const amb = resolvePlatformInboundReplyFromContexts([
    { workspaceId: "ws_a", conversationId: "c1", lastOutboundAt: new Date() },
    { workspaceId: "ws_b", conversationId: "c2", lastOutboundAt: new Date(Date.now() - 1000) },
  ]);
  assert.equal(amb.status, "AMBIGUOUS");
  assert.deepEqual(amb.workspaceIds.sort(), ["ws_a", "ws_b"]);
}

const platformPhoneId = process.env.MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID?.trim();
const platformFrom = process.env.VOICE_OUTBOUND_SMS_FROM_E164?.trim();
if (!platformPhoneId || !platformFrom) {
  console.log("SKIP integration: set MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID + VOICE_OUTBOUND_SMS_FROM_E164");
  process.exit(0);
}

const platformRow = await prisma.phoneNumber.findUnique({
  where: { id: platformPhoneId },
  select: { id: true, e164: true, workspaceId: true, provider: true, settingsJson: true },
});
assert.ok(platformRow?.e164, "platform phone row missing");

const caller = `+1555${String(Date.now()).slice(-7)}`;
const ws1 = `ws_test_mctb_${createId().slice(0, 8)}`;
const ws2 = `ws_test_mctb_${createId().slice(0, 8)}`;

for (const ws of [ws1, ws2]) {
  await prisma.workspace.create({ data: { id: ws, name: `MCTB routing test ${ws}` } }).catch(() => undefined);
}

const dest = {
  phoneNumberId: platformRow.id,
  e164: platformRow.e164,
  workspaceId: platformRow.workspaceId,
  provider: String(platformRow.provider || "telnyx"),
};

const event1 = await prisma.missedCallEvent.create({
  data: {
    id: createId(),
    workspaceId: ws1,
    callerE164: caller,
    businessE164: "+15551234001",
    reason: "NO_ANSWER",
    status: "SENT",
    smsSentAt: new Date(),
    idempotencyKey: `test-mctb-routing:${ws1}:${caller}`,
    metadata: {
      outboundSmsPhoneNumberId: platformRow.id,
      outboundSmsFromE164: platformRow.e164,
    },
  },
});

const event2 = await prisma.missedCallEvent.create({
  data: {
    id: createId(),
    workspaceId: ws2,
    callerE164: caller,
    businessE164: "+15551234002",
    reason: "NO_ANSWER",
    status: "SENT",
    smsSentAt: new Date(),
    idempotencyKey: `test-mctb-routing:${ws2}:${caller}`,
    metadata: {
      outboundSmsPhoneNumberId: platformRow.id,
      outboundSmsFromE164: platformRow.e164,
    },
  },
});

const claim1 = await claimPlatformSenderAssignment({
  workspaceId: ws1,
  consumerE164: caller,
  platformPhoneNumberId: platformRow.id,
  missedCallEventId: event1.id,
});
const claim2 = await claimPlatformSenderAssignment({
  workspaceId: ws2,
  consumerE164: caller,
  platformPhoneNumberId: platformRow.id,
  missedCallEventId: event2.id,
});
assert.ok(claim1.status === "CLAIMED" || claim1.status === "REUSED");
assert.ok(claim2.status === "CLAIMED" || claim2.status === "REUSED");

const active = await findActivePlatformSenderAssignments({
  consumerE164: caller,
  platformPhoneNumberId: platformRow.id,
});
assert.equal(active.length, 2, "expected two active assignments for ambiguity test");

const ambiguous = await dispatchPlatformMctbInboundSms({
  channel: "telnyx",
  destination: dest,
  fromE164: caller,
  body: "Yes please call me back",
  providerMessageId: `test-ambig-${createId()}`,
});
assert.equal(ambiguous.resolution, "ambiguous_platform_reply");

const held = await prisma.arSmsInboundHeldMessage.findFirst({
  where: { fromE164: caller, holdReason: "ambiguous_mctb_assignments" },
  orderBy: { createdAt: "desc" },
});
assert.ok(held, "held message recorded for ambiguous reply");

// Release ws2 assignment — single workspace should resolve
await prisma.mctbPlatformSenderAssignment.updateMany({
  where: { workspaceId: ws2, consumerE164: caller, state: "ACTIVE" },
  data: { state: "RELEASED", releasedAt: new Date(), releaseReason: "ADMIN_RELEASE" },
});

const providerMessageId = `test-resolved-${createId()}`;
const resolved = await dispatchPlatformMctbInboundSms({
  channel: "telnyx",
  destination: dest,
  fromE164: caller,
  body: "Thanks",
  providerMessageId,
});
assert.equal(resolved.resolution, "platform_reply_resolved");
assert.equal(resolved.workspaceId, ws1);

const dup = await dispatchPlatformMctbInboundSms({
  channel: "telnyx",
  destination: dest,
  fromE164: caller,
  body: "Thanks",
  providerMessageId,
});
assert.equal(dup.resolution, "platform_reply_resolved");

const msg = await prisma.conversationMessage.findFirst({
  where: { providerMessageId },
});
assert.ok(msg, "inbound message stored once");

console.log("PASS test-mctb-platform-inbound-routing");
