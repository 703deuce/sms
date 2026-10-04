#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  messageLooksLikeBusinessQuestion,
  shouldTryKnowledgeBeforeTransactionalFlow,
} from "../src/lib/mctb/ai-recovery/customer-intent-first-heuristics.ts";
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

const pipeline = readFileSync("src/lib/mctb/ai-booking/sms-conversation-pipeline.ts", "utf8");
assert.match(pipeline, /tryKnowledgeFirstSmsReply/);

console.log("test-mctb-customer-intent-first-reply: OK");
