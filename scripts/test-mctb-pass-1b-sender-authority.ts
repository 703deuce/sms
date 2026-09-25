#!/usr/bin/env tsx
/**
 * MCTB Pass 1B — sender authority & inbox capability matrix (pure + source).
 * Run: npx tsx scripts/test-mctb-pass-1b-sender-authority.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deriveMctbInboxCapabilitiesFromInputs } from "../src/lib/mctb/inbox/capabilities-derive";

const freePlatform = deriveMctbInboxCapabilitiesFromInputs({
  senderMode: "PLATFORM",
  paid: false,
  workspaceMessagingReady: false,
  platformSenderReady: true,
  bookingEntitled: false,
  conversationEnabled: true,
});
assert.equal(freePlatform.canUsePress1, true);
assert.equal(freePlatform.canUseExistingConsent, false);
assert.equal(freePlatform.canUseBookingLink, false);
assert.equal(freePlatform.canUseFreeformMessaging, false);
assert.equal(freePlatform.canUseSavedReplies, false);
assert.equal(freePlatform.messagingAuthority, "platform_responses_only");

const paidPlatform = deriveMctbInboxCapabilitiesFromInputs({
  senderMode: "PLATFORM",
  paid: true,
  workspaceMessagingReady: false,
  platformSenderReady: true,
  bookingEntitled: true,
  conversationEnabled: true,
});
assert.equal(paidPlatform.canUseExistingConsent, false);
assert.equal(paidPlatform.canUseBookingLink, true);
assert.equal(paidPlatform.canUseFreeformMessaging, false);
assert.equal(paidPlatform.canUseSavedReplies, false);

const a2pReady = deriveMctbInboxCapabilitiesFromInputs({
  senderMode: "WORKSPACE",
  paid: true,
  workspaceMessagingReady: true,
  platformSenderReady: false,
  bookingEntitled: true,
  conversationEnabled: true,
});
assert.equal(a2pReady.canUseFreeformMessaging, true);
assert.equal(a2pReady.canUseSavedReplies, true);
assert.equal(a2pReady.messagingAuthority, "full_two_way");

const a2pNotReady = deriveMctbInboxCapabilitiesFromInputs({
  senderMode: "WORKSPACE",
  paid: true,
  workspaceMessagingReady: false,
  platformSenderReady: false,
  bookingEntitled: true,
  conversationEnabled: true,
});
assert.equal(a2pNotReady.canUseFreeformMessaging, false);

const opted = deriveMctbInboxCapabilitiesFromInputs({
  senderMode: "WORKSPACE",
  paid: true,
  workspaceMessagingReady: true,
  platformSenderReady: false,
  bookingEntitled: true,
  conversationEnabled: true,
  contactOptedOut: true,
});
assert.equal(opted.messagingAuthority, "opted_out");
assert.equal(opted.canUseFreeformMessaging, false);

const inboxRoute = readFileSync("src/app/api/inbox/[id]/route.ts", "utf8");
assert.match(inboxRoute, /assertMctbInboxOutboundAllowed/);
assert.match(inboxRoute, /ensureMctbHumanOwnershipBeforeManualSend/);

const setupRoute = readFileSync("src/app/api/mctb/setup/route.ts", "utf8");
assert.match(setupRoute, /Existing consent mode requires a paid MCTB plan/);

const thread = readFileSync("src/components/inbox/conversations-thread-area.tsx", "utf8");
assert.match(thread, /useMctbInboxCapabilities/);
assert.match(thread, /mctbBookingEnabled/);
assert.match(thread, /smsEnabled=\{mctbSmsEnabled\}/);

console.log("test-mctb-pass-1b-sender-authority: OK");
