#!/usr/bin/env tsx
/**
 * Ensures intent classification does not imply actions — only saved policy does.
 */
import assert from "node:assert/strict";
import { evaluateLeadRecoveryPolicyForIntent } from "../src/lib/mctb/lead-recovery/policy-engine";
import type { LeadRecoveryConversationState, LeadRecoveryWorkspaceConfig } from "../src/lib/mctb/lead-recovery/types";

function baseState(): LeadRecoveryConversationState {
  return {
    conversationId: "t",
    workspaceId: "w",
    currentIntent: "EMERGENCY_OR_URGENT",
    secondaryIntents: [],
    leadType: "NEW",
    urgency: "EMERGENCY",
    serviceCategory: null,
    collectedFields: {},
    missingFields: [],
    qualification: null,
    activeSpecialist: null,
    phase: "IDLE",
    clarificationAttempts: 0,
    lastIntent: null,
    intentPlan: { pendingIntents: [], completedIntents: [], blockedIntents: [], currentIntent: null },
    updatedAt: new Date().toISOString(),
  };
}

const workspace: LeadRecoveryWorkspaceConfig = {
  enabled: true,
  version: 1,
  globalMode: "STANDARD",
  enabledScenarios: { emergencies: true },
  enabledIntents: ["EMERGENCY_OR_URGENT"],
  intentPolicies: {
    EMERGENCY_OR_URGENT: {
      enabled: true,
      collect: ["ADDRESS"],
      actions: ["CREATE_CALLBACK_REQUEST", "CUSTOMER_MESSAGE"],
    },
  },
  fallbackPolicy: { enabled: true, collect: [], actions: ["CUSTOMER_MESSAGE"] },
  globalBehavior: {},
  paymentPolicy: {},
  serviceAreaPolicy: { inAreaAction: "continue", outOfAreaAction: "decline", uncertainAction: "clarify_zip" },
  existingCustomerPolicy: { treatDifferently: true, actions: [] },
  faqPolicy: { topics: [], fallback: "clarify" },
  collectCapabilities: [],
  answerCapabilities: [],
  actionCapabilities: ["CREATE_CALLBACK_REQUEST", "CUSTOMER_MESSAGE", "SEND_OWNER_SMS"],
  handoffTriggers: { uncertain: true, complaint: true, sensitive: true, emergency: true, highValue: false },
  policyHealth: "READY",
  scenarioHealth: {},
};

const intent = {
  primary_intent: "EMERGENCY_OR_URGENT" as const,
  secondary_intents: [] as const,
  lead_type: "NEW" as const,
  urgency: "EMERGENCY" as const,
  service_category: null,
  reason_for_contact: "water pouring",
  location: { raw: null, resolved: null },
  requested_time: null,
  booking_requested: false,
  callback_requested: false,
  payment_intent: false,
  complaint: false,
  human_required: false,
  language: "en",
  confidence: 0.9,
  missing_required_fields: [],
};

const plan = evaluateLeadRecoveryPolicyForIntent({
  workspace,
  intent,
  targetIntent: "EMERGENCY_OR_URGENT",
  collectedData: {},
  conversationState: baseState(),
});

const actionIds = plan.nextActions.map((a) => a.action);
assert.ok(!actionIds.includes("SEND_OWNER_SMS"), "emergency intent must not imply owner SMS without policy");
assert.ok(!actionIds.includes("AI_BOOK"), "emergency intent must not imply booking without policy");
assert.ok(actionIds.includes("CREATE_CALLBACK_REQUEST") || plan.phase === "COLLECT");

console.log("test-mctb-lead-recovery-intent-policy-separation: PASS");
