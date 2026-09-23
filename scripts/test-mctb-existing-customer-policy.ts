#!/usr/bin/env tsx
/**
 * Existing-customer scenario boundaries (policy + runtime gating).
 * npx tsx scripts/test-mctb-existing-customer-policy.ts
 */
import assert from "node:assert/strict";
import { defaultIntentPolicies } from "../src/lib/mctb/lead-recovery/policy-defaults";
import { simulateLeadRecoveryPolicy } from "../src/lib/mctb/lead-recovery/policy-engine";
import { intentsForEnabledScenarios } from "../src/lib/mctb/lead-recovery/scenarios";
import type { LeadRecoveryWorkspaceConfig, StructuredLeadIntent } from "../src/lib/mctb/lead-recovery/types";

function baseConfig(
  overrides: Partial<LeadRecoveryWorkspaceConfig>,
): LeadRecoveryWorkspaceConfig {
  const policies = defaultIntentPolicies("SEND_BOOKING_LINK");
  return {
    enabled: true,
    version: 1,
    globalMode: "STANDARD",
    enabledScenarios: { existing_customer: true },
    enabledIntents: intentsForEnabledScenarios({ existing_customer: true }),
    intentPolicies: policies,
    fallbackPolicy: policies.UNKNOWN!,
    globalBehavior: { tone: "professional", maxClarificationAttempts: 2, followUpEnabled: false },
    paymentPolicy: {
      textToPayEnabled: false,
      amountAuthority: "customer_provides",
      fixedFeeAmountMinor: null,
      fixedFeeCurrency: "usd",
    },
    serviceAreaPolicy: {
      enabled: false,
      zipAllowList: [],
      outOfAreaAction: "decline",
      uncertainAction: "clarify_zip",
    },
    existingCustomerPolicy: {
      treatDifferently: true,
      actions: ["CREATE_CALLBACK_REQUEST", "SEND_EMAIL_SUMMARY"],
      notifyRecipientId: null,
    },
    faqPolicy: { topics: ["FAQ"], fallback: "clarify" },
    migratedFromAiBooking: false,
    collectCapabilities: ["REASON", "ISSUE_DESCRIPTION"],
    answerCapabilities: [],
    actionCapabilities: [
      "CREATE_CALLBACK_REQUEST",
      "SEND_EMAIL_SUMMARY",
      "ESCALATE_HUMAN",
      "CUSTOMER_MESSAGE",
      "ROUTE_TO_TEAM",
    ],
    handoffTriggers: { uncertain: true, complaint: true, sensitive: true, emergency: true, highValue: false },
    bookingLinkId: null,
    policyHealth: "READY",
    scenarioHealth: {},
    ...overrides,
  };
}

const existingIssueIntent: StructuredLeadIntent = {
  primary_intent: "EXISTING_CUSTOMER_ISSUE",
  secondary_intents: [],
  confidence: 0.9,
  urgency: "NORMAL",
  lead_type: "EXISTING",
  complaint: false,
  human_requested: false,
  reason_for_contact: "Follow up on yesterday's visit",
  service_category: null,
  extracted_entities: {},
  booking_requested: false,
  booking_disposition: "NONE",
  workflow_updates: [],
};

const cancelIntent: StructuredLeadIntent = {
  ...existingIssueIntent,
  primary_intent: "CANCEL_REQUEST",
  reason_for_contact: "Cancel my appointment",
};

const supported = simulateLeadRecoveryPolicy({
  config: baseConfig({}),
  intent: existingIssueIntent,
  collectedData: { ISSUE_DESCRIPTION: "AC not cooling" },
});
assert.ok(
  supported.nextActions.some((a) => a.action === "CREATE_CALLBACK_REQUEST"),
  "supported existing-customer issue runs configured actions",
);

const scenarioOff = simulateLeadRecoveryPolicy({
  config: baseConfig({
    enabledScenarios: { existing_customer: false },
    enabledIntents: intentsForEnabledScenarios({ existing_customer: false }),
  }),
  intent: existingIssueIntent,
});
assert.equal(
  scenarioOff.matchedPolicyId,
  "fallback:scenario_off",
  "disabled scenario falls back — no existing-customer-specific policy",
);

const treatSame = simulateLeadRecoveryPolicy({
  config: baseConfig({
    existingCustomerPolicy: {
      treatDifferently: false,
      actions: ["CREATE_CALLBACK_REQUEST"],
      notifyRecipientId: null,
    },
  }),
  intent: existingIssueIntent,
});
assert.equal(
  treatSame.matchedPolicyId,
  "fallback:existing_customer_generic",
  "treatDifferently off uses generic fallback",
);

const cancelPlan = simulateLeadRecoveryPolicy({
  config: baseConfig({}),
  intent: cancelIntent,
  collectedData: { ISSUE_DESCRIPTION: "Tomorrow at 3" },
});
assert.ok(
  cancelPlan.nextActions.some((a) => a.action === "ESCALATE_HUMAN" || a.action === "CREATE_CALLBACK_REQUEST"),
  "cancel request escalates or callbacks — no automated cancel",
);
assert.ok(
  !cancelPlan.nextActions.some((a) => a.action === "AI_BOOK"),
  "cancel path does not book",
);

console.log("test-mctb-existing-customer-policy: PASS");
