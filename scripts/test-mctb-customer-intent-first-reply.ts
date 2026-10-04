#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  messageLooksLikeBusinessQuestion,
  shouldTryKnowledgeBeforeTransactionalFlow,
  leadRecoveryFieldCollectionBlocksKnowledge,
} from "../src/lib/mctb/ai-recovery/customer-intent-first-heuristics.ts";
import { normalizeConversationalAiRecoveryConfig } from "../src/lib/mctb/ai-recovery/conversational-sms-config.ts";
import { defaultSmsCollectFields } from "../src/lib/mctb/ai-recovery/collect-field-schema.ts";
import { DEFAULT_LEAD_RECOVERY_FALLBACK } from "../src/lib/mctb/lead-recovery/policy-defaults.ts";
import type { StructuredLeadIntent } from "../src/lib/mctb/lead-recovery/types.ts";

function baseIntent(overrides: Partial<StructuredLeadIntent>): StructuredLeadIntent {
  return {
    primary_intent: "GENERAL_INQUIRY",
    secondary_intents: [],
    confidence: 0.9,
    booking_requested: false,
    booking_disposition: "NONE",
    callback_requested: false,
    human_requested: false,
    payment_intent: false,
    needs_clarification: false,
    urgency: "NORMAL",
    lead_type: "NEW",
    service_category: null,
    reason_for_contact: null,
    extracted_entities: {},
    workflow_updates: [],
    opt_out_scope: null,
    ...overrides,
  };
}

assert.equal(messageLooksLikeBusinessQuestion("What do you guys do"), true);
assert.equal(messageLooksLikeBusinessQuestion("book me tomorrow"), false);
assert.equal(messageLooksLikeBusinessQuestion("Book tomorrow?"), true);

assert.equal(
  shouldTryKnowledgeBeforeTransactionalFlow({
    classified: baseIntent({ primary_intent: "BOOKING_REQUEST", booking_requested: true }),
    customerMessage: "What do you do?",
    collectActive: false,
    bookingWorkflowActive: false,
  }),
  true,
);

assert.equal(
  shouldTryKnowledgeBeforeTransactionalFlow({
    classified: baseIntent({ primary_intent: "BOOKING_REQUEST", booking_requested: true }),
    customerMessage: "Book me Friday afternoon",
    collectActive: false,
    bookingWorkflowActive: false,
  }),
  false,
);

assert.equal(
  shouldTryKnowledgeBeforeTransactionalFlow({
    classified: baseIntent({ primary_intent: "BOOKING_REQUEST", booking_requested: true }),
    customerMessage: "Book me Friday",
    collectActive: false,
    bookingWorkflowActive: true,
  }),
  false,
);

assert.equal(
  shouldTryKnowledgeBeforeTransactionalFlow({
    classified: baseIntent({ primary_intent: "UNKNOWN", confidence: 0.2 }),
    customerMessage: "What do you guys do",
    collectActive: true,
    bookingWorkflowActive: false,
  }),
  true,
  "business questions must not be blocked by stale missingFields on old threads",
);

const pipeline = readFileSync("src/lib/mctb/ai-booking/sms-conversation-pipeline.ts", "utf8");
assert.match(pipeline, /tryKnowledgeFirstSmsReply/);

assert.equal(
  leadRecoveryFieldCollectionBlocksKnowledge(
    { phase: "COLLECT", pendingAction: { action: "COLLECT_FIELD" } },
    "What do you guys do",
  ),
  false,
);

assert.equal(DEFAULT_LEAD_RECOVERY_FALLBACK.collect.length, 0);
assert.ok(defaultSmsCollectFields().every((f) => !f.enabled));

const normalized = normalizeConversationalAiRecoveryConfig({
  enabled: true,
  version: 1,
  globalMode: "STANDARD",
  enabledScenarios: {},
  enabledIntents: ["GENERAL_INQUIRY"],
  intentPolicies: {
    GENERAL_INQUIRY: {
      enabled: true,
      collect: ["NAME", "REASON"],
      actions: ["CUSTOMER_MESSAGE"],
    },
  },
  fallbackPolicy: {
    enabled: true,
    collect: ["NAME", "REASON"],
    actions: ["CUSTOMER_MESSAGE"],
  },
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
  migratedFromAiBooking: false,
  collectCapabilities: [],
  answerCapabilities: [],
  actionCapabilities: ["ANSWER_APPROVED_INFORMATION", "CUSTOMER_MESSAGE"],
  handoffTriggers: {
    uncertain: true,
    complaint: true,
    sensitive: true,
    emergency: true,
    highValue: false,
  },
  bookingLinkId: null,
  policyHealth: "READY",
  scenarioHealth: {},
  smsCollectFields: defaultSmsCollectFields(),
  allowDynamicCustomQuestions: true,
});
assert.deepEqual(normalized.intentPolicies.GENERAL_INQUIRY?.collect, []);
assert.deepEqual(normalized.fallbackPolicy.collect, []);

console.log("test-mctb-customer-intent-first-reply: OK");
