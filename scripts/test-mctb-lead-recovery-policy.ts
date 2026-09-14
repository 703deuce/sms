#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { simulateLeadRecoveryPolicy } from "../src/lib/mctb/lead-recovery/policy-engine";
import { deterministicLeadRecoveryIntent } from "../src/lib/mctb/lead-recovery/testing/legacy-keyword-intent-classifier";
import type {
  IntentPolicyShape,
  LeadRecoveryWorkspaceConfig,
} from "../src/lib/mctb/lead-recovery/types";

function baseConfig(
  emergencyPolicy: IntentPolicyShape,
): LeadRecoveryWorkspaceConfig {
  return {
    enabled: true,
    version: 1,
    globalMode: "STANDARD",
    enabledIntents: ["EMERGENCY_OR_URGENT"],
    intentPolicies: { EMERGENCY_OR_URGENT: emergencyPolicy },
    fallbackPolicy: { enabled: true, collect: [], actions: ["CUSTOMER_MESSAGE"] },
    collectCapabilities: ["ADDRESS", "ISSUE_DESCRIPTION"],
    answerCapabilities: [],
    actionCapabilities: [
      "SEND_OWNER_SMS",
      "SEND_BOOKING_LINK",
      "AI_BOOK",
      "ROUTE_TO_ON_CALL",
      "CREATE_CALLBACK_REQUEST",
      "CUSTOMER_MESSAGE",
      "ESCALATE_HUMAN",
    ],
    handoffTriggers: {
      uncertain: true,
      complaint: true,
      sensitive: true,
      emergency: true,
      highValue: false,
    },
    policyHealth: "READY",
  };
}

const intent = deterministicLeadRecoveryIntent({
  message: "There's water pouring out of the ceiling.",
});
assert.equal(intent.primary_intent, "EMERGENCY_OR_URGENT");

const policyA = simulateLeadRecoveryPolicy({
  config: baseConfig({
    enabled: true,
    collect: ["ADDRESS", "ISSUE_DESCRIPTION"],
    actions: ["SEND_OWNER_SMS", "CREATE_CALLBACK_REQUEST", "CUSTOMER_MESSAGE"],
    customerMessage: "Someone will contact you shortly.",
  }),
  intent,
  collectedData: { ISSUE_DESCRIPTION: "active leak", ADDRESS: "123 Main" },
});

const policyB = simulateLeadRecoveryPolicy({
  config: baseConfig({
    enabled: true,
    collect: [],
    actions: ["SEND_BOOKING_LINK", "CUSTOMER_MESSAGE"],
    customerMessage: "Use our emergency booking link.",
  }),
  intent,
  collectedData: { ISSUE_DESCRIPTION: "active leak" },
});

const policyC = simulateLeadRecoveryPolicy({
  config: baseConfig({
    enabled: true,
    collect: ["ADDRESS"],
    actions: ["AI_BOOK"],
  }),
  intent,
  collectedData: { ADDRESS: "123 Main", ISSUE_DESCRIPTION: "leak" },
});

const policyD = simulateLeadRecoveryPolicy({
  config: baseConfig({
    enabled: true,
    collect: ["ADDRESS"],
    actions: ["ROUTE_TO_ON_CALL", "CUSTOMER_MESSAGE"],
  }),
  intent,
  collectedData: { ADDRESS: "123 Main" },
});

assert.ok(policyA.nextActions.some((a) => a.action === "SEND_OWNER_SMS"));
assert.ok(policyB.nextActions.some((a) => a.action === "SEND_BOOKING_LINK"));
assert.ok(policyC.nextActions.some((a) => a.action === "AI_BOOK"));
assert.ok(policyD.nextActions.some((a) => a.action === "ROUTE_TO_ON_CALL"));

const pricingIntent = deterministicLeadRecoveryIntent({
  message: "How much to replace my water heater?",
});
const pricingPolicy = simulateLeadRecoveryPolicy({
  config: baseConfig({
    enabled: true,
    collect: ["ADDRESS"],
    mode: "ESTIMATE_REQUIRED",
    actions: ["CREATE_CALLBACK_REQUEST", "CUSTOMER_MESSAGE"],
    customerMessage: "I can have the team provide an exact quote.",
  }),
  intent: pricingIntent,
});
assert.ok(pricingPolicy.responseConstraints.mustNotInventPricing);

const policySrc = readFileSync("src/lib/mctb/lead-recovery/policy-engine.ts", "utf8");
const runtimeSrc = readFileSync("src/lib/mctb/lead-recovery/action-runtime.ts", "utf8");
assert.ok(!policySrc.includes("openAiChatCompletion"));
assert.ok(!runtimeSrc.includes("stripe.checkout"));
assert.ok(!runtimeSrc.includes("bookEventInvitee"));

const customerSms = readFileSync("src/lib/agents/missed-call-text-back/customer-sms.ts", "utf8");
assert.ok(customerSms.includes("handleMctbLeadRecoveryInboundSms"));

console.log("test-mctb-lead-recovery-policy: OK");
