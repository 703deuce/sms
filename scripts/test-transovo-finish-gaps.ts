/**
 * Hermetic tests for Transovo finish gaps.
 * Run: npx tsx scripts/test-transovo-finish-gaps.ts
 */
import assert from "node:assert/strict";
import {
  validateMctbLinkDestinationUrl,
  wrapMctbMessageUrlsWithTracking,
} from "../src/lib/mctb/link-tracking";
import {
  parseMctbRecoveryEventIdFromIdempotencyKey,
  resolveMctbLinkDestinationUrl,
  resolveMctbTemplateVars,
} from "../src/lib/mctb/template-vars";
import {
  validateRoutingDestinationLoop,
  validateSmartRoutingFlowDestinations,
} from "../src/lib/smart-routing/loop-validation";
import { DEFAULT_MCTB_CONFIG } from "../src/lib/agents/missed-call-text-back/types";
import {
  buildDirectDialForwardPromptText,
  resolveMctbDirectDialForwardE164,
} from "../src/lib/mctb/direct-dial-prompt";
import { loadPlatformActivityFeed } from "../src/lib/platform/activity-feed";

// Direct dial prompt
assert.equal(
  resolveMctbDirectDialForwardE164({
    ...DEFAULT_MCTB_CONFIG,
    id: "cfg",
    workspaceId: "ws",
    directDialForwardE164: "+15559876543",
  }),
  "+15559876543",
);
assert.ok(
  buildDirectDialForwardPromptText(
    {
      ...DEFAULT_MCTB_CONFIG,
      id: "cfg",
      workspaceId: "ws",
      directDialForwardE164: "+15559876543",
    },
    "Acme Plumbing",
  )?.includes("Acme"),
);

assert.equal(typeof loadPlatformActivityFeed, "function");

// Link tracking
assert.equal(validateMctbLinkDestinationUrl("https://example.com").ok, true);
assert.equal(validateMctbLinkDestinationUrl("javascript:alert(1)").ok, false);
assert.equal(validateMctbLinkDestinationUrl("ftp://example.com").ok, false);

const wrapped = wrapMctbMessageUrlsWithTracking({
  body: "Visit https://example.com for details",
  destinationUrl: "https://example.com",
});
assert.ok(wrapped.body.includes("/r/"));
assert.equal(wrapped.destinationUrl, "https://example.com/");

// Template vars + idempotency
const eventId = "evt_test_123";
assert.equal(
  parseMctbRecoveryEventIdFromIdempotencyKey(`mctb-recovery:${eventId}`),
  eventId,
);
const vars = resolveMctbTemplateVars({
  config: {
    ...DEFAULT_MCTB_CONFIG,
    id: "cfg",
    workspaceId: "ws",
    defaultLinkUrl: "https://example.com/book",
  },
  callerE164: "+15551234567",
  contact: { firstName: "Sam" },
});
assert.equal(vars.firstName, "Sam");
assert.equal(resolveMctbLinkDestinationUrl({
  ...DEFAULT_MCTB_CONFIG,
  id: "cfg",
  workspaceId: "ws",
  defaultLinkUrl: "https://example.com",
}), "https://example.com");

// Loop validation
const loop = validateRoutingDestinationLoop({
  destinationE164: "+15715550100",
  routingNumberE164: "+15715550100",
});
assert.ok(loop);
assert.equal(loop?.code, "ROUTING_LOOP");

const flowCheck = validateSmartRoutingFlowDestinations({
  draft: {
    nodes: [
      {
        id: "t1",
        type: "TRANSFER_EXTERNAL",
        config: { phoneNumber: "+15715550100" },
      },
    ],
    edges: [],
  },
  routingNumberE164: "+15715550100",
});
assert.equal(flowCheck.valid, false);
assert.ok(flowCheck.issues.length > 0);

// Messaging gate regression (c4beb69d): stale messagingEnabled must not block when Telnyx approved
import { isMessagingSendAuthorized } from "../src/lib/messaging/status";
const staleTelnyxApproved = {
  paused: false,
  messagingEnabled: false,
  overallStatus: "action_required",
  phoneAttached: true,
  phoneE164: "+15715551234",
  messagingProvider: "telnyx",
  brandStatus: "approved",
  campaignStatus: "approved",
  messagingProfileId: "mp_test",
  campaignId: "camp_test",
} as never;
assert.equal(isMessagingSendAuthorized(staleTelnyxApproved), true);
const blocked = {
  paused: false,
  messagingEnabled: false,
  overallStatus: "action_required",
  phoneAttached: false,
  messagingProvider: "telnyx",
} as never;
assert.equal(isMessagingSendAuthorized(blocked), false);
// sendViaRegistration uses isMessagingSendAuthorized (not isMessagingReady alone) — see registration-processor.ts

import * as outbound from "../src/lib/mctb/messaging/outbound-sms-route";
assert.equal(typeof outbound.resolveMctbOutboundSmsRoute, "function");

// Trial grant route module exports POST handler (compile-time import)
import * as trialRoute from "../src/app/api/platform/billing/trial/route";
assert.equal(typeof trialRoute.POST, "function");

console.log("test-transovo-finish-gaps: ok");
