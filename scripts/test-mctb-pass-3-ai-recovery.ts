#!/usr/bin/env tsx
/**
 * MCTB Pass 3 — simplified AI Recovery surface contracts.
 * Run: npx tsx scripts/test-mctb-pass-3-ai-recovery.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  deriveSimplifiedFieldEnabled,
  simplifiedTogglesToCollectCapabilities,
} from "../src/lib/mctb/ai-recovery/simplified-fields";
import { buildAiRecoverySavePatch } from "../src/lib/mctb/ai-recovery/sync-collection-config";
import { defaultIntentPolicies } from "../src/lib/mctb/lead-recovery/policy-defaults";
import type { LeadRecoveryWorkspaceConfig } from "../src/lib/mctb/lead-recovery/types";

const toggles = {
  NAME: true,
  REASON: true,
  ADDRESS: false,
  URGENCY: true,
  CALLBACK_TIME: true,
};
const caps = simplifiedTogglesToCollectCapabilities(toggles);
assert.ok(caps.includes("NAME"));
assert.ok(caps.includes("CALLBACK_NUMBER"));
assert.equal(deriveSimplifiedFieldEnabled(caps).ADDRESS, false);

const existing: LeadRecoveryWorkspaceConfig = {
  enabled: false,
  version: 1,
  globalMode: "STANDARD",
  enabledScenarios: {},
  enabledIntents: [],
  intentPolicies: defaultIntentPolicies("SEND_BOOKING_LINK"),
  fallbackPolicy: defaultIntentPolicies("SEND_BOOKING_LINK").GENERAL_INQUIRY!,
  globalBehavior: {
    tone: "professional",
    maxClarificationAttempts: 1,
    followUpEnabled: true,
    followUpDelayMinutes: 60,
    captureOnly: false,
  },
  paymentPolicy: {
    textToPayEnabled: true,
    amountAuthority: "known_balance",
    fixedFeeAmountMinor: null,
    fixedFeeCurrency: "usd",
  },
  serviceAreaPolicy: {
    source: "workspace",
    inAreaAction: "continue",
    outOfAreaAction: "decline",
    uncertainAction: "clarify_zip",
  },
  existingCustomerPolicy: {
    treatDifferently: true,
    actions: ["CREATE_CALLBACK_REQUEST"],
    notifyRecipientId: null,
  },
  faqPolicy: { topics: ["FAQ"], fallback: "clarify" },
  migratedFromAiBooking: false,
  collectCapabilities: [],
  answerCapabilities: [],
  actionCapabilities: ["AI_BOOK", "SEND_BOOKING_LINK"],
  handoffTriggers: {
    uncertain: true,
    complaint: true,
    sensitive: true,
    emergency: true,
    highValue: false,
  },
  bookingLinkId: null,
  policyHealth: "DISABLED",
  scenarioHealth: {},
};

const patch = buildAiRecoverySavePatch({
  enabled: true,
  fieldToggles: toggles,
  bookingLinkEnabled: true,
  bookingLinkId: "link-1",
  existing,
});

assert.equal(patch.globalBehavior?.followUpEnabled, false);
assert.equal(patch.paymentPolicy?.textToPayEnabled, false);
assert.ok(!patch.actionCapabilities?.includes("AI_BOOK"));
const booking = patch.intentPolicies?.BOOKING_REQUEST;
assert.ok(booking?.actions?.includes("SEND_BOOKING_LINK"));
assert.ok(!booking?.actions?.includes("AI_BOOK"));

const page = readFileSync("src/components/mctb/ai-recovery/ai-recovery-settings-page.tsx", "utf8");
assert.doesNotMatch(page, /AI_BOOK/);
assert.doesNotMatch(page, /temperature/i);
assert.doesNotMatch(page, /follow-up/i);
assert.match(page, /Information to collect/);

const legacy = readFileSync("src/app/(app)/mctb/ai-lead-recovery/page.tsx", "utf8");
assert.match(legacy, /redirect/);
assert.match(legacy, /aiRecovery/);

const nav = readFileSync("src/lib/products/mctb-nav.ts", "utf8");
assert.match(nav, /AI Recovery/);
assert.match(nav, /aiRecovery/);

const contextRoute = readFileSync("src/app/api/mctb/ai-recovery/context/route.ts", "utf8");
assert.match(
  contextRoute,
  /deriveRequiredActions\(compliance\.registration,\s*phoneNumbers\)/,
  "messaging readiness must pass phone numbers, not registration row",
);
assert.doesNotMatch(contextRoute, /loadRegistration/);

const saveBundle = readFileSync("src/lib/mctb/ai-recovery/save-bundle.ts", "utf8");
assert.match(saveBundle, /ai_recovery_save_mutated_consent_mode/);
assert.match(saveBundle, /Does not read or write consent mode/);

const saveRoute = readFileSync("src/app/api/mctb/ai-recovery/save/route.ts", "utf8");
assert.match(saveRoute, /saveAiRecoveryBundle/);
assert.match(saveRoute, /runtimeArmed/);

const connectedPage = readFileSync(
  "src/newui-transplant/connected/mctb/ai-recovery-page.tsx",
  "utf8",
);
assert.match(connectedPage, /\/api\/mctb\/ai-recovery\/save/);

console.log("test-mctb-pass-3-ai-recovery: OK");
