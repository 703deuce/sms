#!/usr/bin/env tsx
/**
 * Recovery goal → prompt block + save patch mapping.
 * Run: npx tsx scripts/test-mctb-recovery-goal-prompt.ts
 */
import assert from "node:assert/strict";
import {
  composeRecoveryGoalPromptBlock,
  enabledScenariosForRecoveryGoal,
  inferMctbAiRecoveryGoalType,
} from "../src/lib/mctb/ai-recovery/recovery-goal";
import { buildAiRecoverySavePatch } from "../src/lib/mctb/ai-recovery/sync-collection-config";
import { defaultIntentPolicies } from "../src/lib/mctb/lead-recovery/policy-defaults";
import type { LeadRecoveryWorkspaceConfig } from "../src/lib/mctb/lead-recovery/types";

const baseExisting: LeadRecoveryWorkspaceConfig = {
  enabled: false,
  version: 1,
  globalMode: "STANDARD",
  enabledScenarios: { booking: true, take_message: true, general_faq: true },
  enabledIntents: [],
  intentPolicies: defaultIntentPolicies("COLLECT_ONLY"),
  fallbackPolicy: defaultIntentPolicies("COLLECT_ONLY").GENERAL_INQUIRY!,
  globalBehavior: {
    tone: "professional",
    maxClarificationAttempts: 1,
    followUpEnabled: false,
    followUpDelayMinutes: 60,
    captureOnly: false,
  },
  paymentPolicy: {
    textToPayEnabled: false,
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
  collectCapabilities: [],
  answerCapabilities: [],
  actionCapabilities: ["SEND_BOOKING_LINK"],
  handoffTriggers: {
    uncertain: true,
    complaint: true,
    sensitive: true,
    emergency: true,
    highValue: false,
  },
  bookingLinkId: "link-1",
  policyHealth: "DISABLED",
  scenarioHealth: {},
};

assert.equal(inferMctbAiRecoveryGoalType(baseExisting), "SCHEDULE");

const followBlock = composeRecoveryGoalPromptBlock({ goal: "FOLLOW_UP" });
assert.ok(followBlock.includes("team will follow up"));
assert.ok(followBlock.includes("not a rigid questionnaire"));

const scheduleBlock = composeRecoveryGoalPromptBlock({ goal: "SCHEDULE" });
assert.ok(scheduleBlock.includes("booking link"));

const customBlock = composeRecoveryGoalPromptBlock({
  goal: "CUSTOM",
  customRecoveryGoal: "Collect appliance make/model",
});
assert.ok(customBlock.includes("Collect appliance make/model"));

const scheduleScenarios = enabledScenariosForRecoveryGoal("SCHEDULE", true);
assert.equal(scheduleScenarios.booking, true);
const followScenarios = enabledScenariosForRecoveryGoal("FOLLOW_UP", true);
assert.equal(followScenarios.booking, false);

const patch = buildAiRecoverySavePatch({
  enabled: true,
  fieldToggles: {
    NAME: true,
    REASON: true,
    ADDRESS: true,
    URGENCY: false,
    CALLBACK_TIME: false,
  },
  bookingLinkEnabled: true,
  bookingLinkId: "link-1",
  recoveryGoalType: "SCHEDULE",
  customRecoveryGoal: null,
  existing: baseExisting,
});
assert.equal(patch.recoveryGoalType, "SCHEDULE");
assert.equal(patch.enabledScenarios?.booking, true);

const followPatch = buildAiRecoverySavePatch({
  enabled: true,
  fieldToggles: {
    NAME: true,
    REASON: true,
    ADDRESS: false,
    URGENCY: false,
    CALLBACK_TIME: false,
  },
  bookingLinkEnabled: false,
  bookingLinkId: null,
  recoveryGoalType: "FOLLOW_UP",
  existing: baseExisting,
});
assert.equal(followPatch.recoveryGoalType, "FOLLOW_UP");
assert.equal(followPatch.enabledScenarios?.booking, false);

console.log("test-mctb-recovery-goal-prompt: PASS");
