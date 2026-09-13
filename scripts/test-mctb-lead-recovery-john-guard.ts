import assert from "node:assert/strict";
import {
  sanitizeJohnReplyForLeadRecovery,
  validateJohnProposedActions,
} from "../src/lib/mctb/lead-recovery/john-policy-guard";
import type { LeadRecoveryWorkspaceConfig } from "../src/lib/mctb/lead-recovery/types";

function baseConfig(): LeadRecoveryWorkspaceConfig {
  return {
    enabled: true,
    version: 1,
    globalMode: "STANDARD",
    enabledScenarios: { emergencies: true, payments: true, booking: true },
    enabledIntents: [],
    intentPolicies: {
      EMERGENCY_OR_URGENT: {
        enabled: true,
        collect: ["ADDRESS"],
        actions: ["CREATE_CALLBACK_REQUEST", "SEND_OWNER_SMS", "CUSTOMER_MESSAGE"],
      },
      BOOKING_REQUEST: {
        enabled: true,
        collect: [],
        actions: ["CREATE_CALLBACK_REQUEST"],
      },
      PRICING_QUESTION: {
        enabled: true,
        collect: [],
        mode: "ESTIMATE_REQUIRED",
        actions: ["CUSTOMER_MESSAGE"],
      },
      PAYMENT_REQUEST: {
        enabled: true,
        collect: [],
        actions: ["CUSTOMER_MESSAGE"],
      },
    },
    fallbackPolicy: { enabled: true, collect: [], actions: ["CUSTOMER_MESSAGE"] },
    globalBehavior: {},
    paymentPolicy: { textToPayEnabled: false },
    serviceAreaPolicy: {},
    existingCustomerPolicy: { treatDifferently: true, actions: [] },
    faqPolicy: { topics: [], fallback: "clarify" },
    collectCapabilities: [],
    answerCapabilities: [],
    actionCapabilities: [
      "AI_BOOK",
      "SEND_TEXT_TO_PAY",
      "CREATE_CALLBACK_REQUEST",
      "SEND_OWNER_SMS",
      "CUSTOMER_MESSAGE",
    ],
    handoffTriggers: {
      uncertain: true,
      complaint: true,
      sensitive: true,
      emergency: true,
      highValue: false,
    },
    policyHealth: "READY",
    scenarioHealth: {},
  };
}

const cfg = baseConfig();

const emergencyBook = validateJohnProposedActions({
  config: cfg,
  turn: { utterance: "flood", interpreted_intent: "book emergency appointment", extracted_information: { proposed_action: "AI_BOOK" } },
});
assert.equal(emergencyBook.ok, false);
if (!emergencyBook.ok) assert.equal(emergencyBook.code, "BLOCKED_BY_POLICY");

const payDisabled = validateJohnProposedActions({
  config: cfg,
  turn: { utterance: "pay deposit", interpreted_intent: "send payment link" },
});
assert.equal(payDisabled.ok, false);

const priceReply = sanitizeJohnReplyForLeadRecovery("Sure, it's $99 for the visit.", cfg);
assert.ok(!/\$99/.test(priceReply));

console.log("test-mctb-lead-recovery-john-guard: PASS");
