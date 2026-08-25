#!/usr/bin/env npx tsx
/**
 * Messaging authority model — provider A2P is runtime gate; onboarding forms are submit-only.
 * Run: npx tsx scripts/test-messaging-send-state-hardening.ts
 */
import assert from "node:assert/strict";
import {
  isMessagingReady,
  isMessagingSendAuthorized,
  isOnboardingSubmissionIncomplete,
  isProviderA2pApproved,
  isTelnyxProviderA2pApproved,
} from "../src/lib/messaging/messaging-authority";

const staleTelnyxApproved = {
  paused: false,
  messagingEnabled: false,
  overallStatus: "action_required",
  phoneAttached: true,
  phoneE164: "+15714073615",
  phoneSid: "3019061761975256346",
  messagingProvider: "telnyx",
  brandStatus: "approved",
  campaignStatus: "approved",
  brandStatusRaw: "VERIFIED",
  campaignStatusRaw: "ACTIVE",
  messagingProfileId: "4001a014-9a5c-4be4-8099-1a75ac4f875d",
  campaignId: "4b30019f-cbf1-6b58-467a-16f15ecbb404",
  lastError: "Complete business details and use case before registration can advance",
  legalBusinessName: null,
  useCase: null,
} as never;

assert.equal(isTelnyxProviderA2pApproved(staleTelnyxApproved), true);
assert.equal(isProviderA2pApproved(staleTelnyxApproved), true);
assert.equal(isMessagingSendAuthorized(staleTelnyxApproved), true);
assert.equal(isMessagingReady(staleTelnyxApproved), true);
assert.equal(isOnboardingSubmissionIncomplete(staleTelnyxApproved), true);

const blocked = {
  paused: false,
  messagingEnabled: false,
  overallStatus: "action_required",
  phoneAttached: false,
  messagingProvider: "telnyx",
} as never;

assert.equal(isTelnyxProviderA2pApproved(blocked), false);
assert.equal(isMessagingSendAuthorized(blocked), false);

console.log("test-messaging-send-state-hardening: ok");
