#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { deterministicLeadRecoveryIntent } from "../src/lib/mctb/lead-recovery/intent-agent";
import { evaluateLeadRecoveryPolicyMulti } from "../src/lib/mctb/lead-recovery/intent-plan";
import type { LeadRecoveryWorkspaceConfig } from "../src/lib/mctb/lead-recovery/types";

const config: LeadRecoveryWorkspaceConfig = {
  enabled: true,
  version: 1,
  globalMode: "STANDARD",
  enabledScenarios: { booking: true, pricing: true },
  enabledIntents: ["BOOKING_REQUEST", "PRICING_QUESTION"],
  intentPolicies: {
    BOOKING_REQUEST: { enabled: true, collect: [], actions: ["AI_BOOK"], mode: "AI_BOOK" },
    PRICING_QUESTION: {
      enabled: true,
      collect: [],
      mode: "ESTIMATE_REQUIRED",
      actions: ["CUSTOMER_MESSAGE"],
      customerMessage: "I can have the team provide an exact quote.",
    },
  },
  fallbackPolicy: { enabled: true, collect: [], actions: ["CUSTOMER_MESSAGE"] },
  globalBehavior: {},
  paymentPolicy: {},
  serviceAreaPolicy: {},
  collectCapabilities: [],
  answerCapabilities: [],
  actionCapabilities: ["AI_BOOK", "CUSTOMER_MESSAGE"],
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

const intent = deterministicLeadRecoveryIntent({
  message: "I need someone tomorrow and how much does it cost?",
});
assert.equal(intent.primary_intent, "BOOKING_REQUEST");
assert.ok(intent.secondary_intents.includes("PRICING_QUESTION"));

const multi = evaluateLeadRecoveryPolicyMulti({
  workspace: config,
  intent,
  collectedData: {},
  conversationState: {
    conversationId: "t",
    workspaceId: "w",
    currentIntent: intent.primary_intent,
    secondaryIntents: intent.secondary_intents,
    leadType: "NEW",
    urgency: "NORMAL",
    serviceCategory: null,
    collectedFields: {},
    missingFields: [],
    qualification: null,
    activeSpecialist: null,
    phase: "IDLE",
    clarificationAttempts: 0,
    lastIntent: intent,
    intentPlan: { pendingIntents: [], completedIntents: [], blockedIntents: [], currentIntent: null },
    updatedAt: new Date().toISOString(),
  },
});

assert.ok(multi.executionPlan.pendingIntents.includes("PRICING_QUESTION"));
assert.equal(multi.primary.intent, "BOOKING_REQUEST");
assert.ok(multi.secondaryPlans.some((p) => p.intent === "PRICING_QUESTION"));

console.log("test-mctb-lead-recovery-multi-intent: OK");
