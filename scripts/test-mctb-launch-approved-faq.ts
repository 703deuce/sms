#!/usr/bin/env tsx
/**
 * MCTB simplified launch — approved FAQ / business information path.
 * npx tsx scripts/test-mctb-launch-approved-faq.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { defaultLaunchEnabledScenarios } from "../src/lib/mctb/lead-recovery/scenarios";
import { launchFaqIntentPolicyOverrides } from "../src/lib/mctb/lead-recovery/launch-faq-policies";
import { defaultIntentPolicies } from "../src/lib/mctb/lead-recovery/policy-defaults";
import { simulateLeadRecoveryPolicy } from "../src/lib/mctb/lead-recovery/policy-engine";
import { isActionPermitted } from "../src/lib/mctb/lead-recovery/action-registry";
import type { LeadRecoveryWorkspaceConfig, StructuredLeadIntent } from "../src/lib/mctb/lead-recovery/types";
import { resolveApprovedInformationReplyForTest } from "../src/lib/mctb/lead-recovery/approved-information-reply";
import type { MctbApprovedBusinessInformation } from "../src/lib/mctb/approved-business-information";
import { isCarrierProtocolOptOutMessage } from "../src/lib/mctb/lead-recovery/protocol-intent";

const launchScenarios = defaultLaunchEnabledScenarios();
assert.equal(launchScenarios.general_faq, true);
assert.equal(launchScenarios.booking, false);
assert.equal(launchScenarios.payments, false);

const faqPolicies = launchFaqIntentPolicyOverrides();
assert.deepEqual(faqPolicies.BUSINESS_HOURS?.actions, ["ANSWER_APPROVED_INFORMATION"]);

const policies = {
  ...defaultIntentPolicies("SEND_BOOKING_LINK"),
  ...faqPolicies,
};

const launchCapabilities: LeadRecoveryWorkspaceConfig["actionCapabilities"] = [
  "SEND_BOOKING_LINK",
  "CREATE_CALLBACK_REQUEST",
  "SEND_EMAIL_SUMMARY",
  "SEND_OWNER_SMS",
  "CUSTOMER_MESSAGE",
  "ANSWER_APPROVED_INFORMATION",
  "ESCALATE_HUMAN",
  "END_AUTOMATION",
  "SUPPRESS_CONTACT",
];

function baseConfig(): LeadRecoveryWorkspaceConfig {
  return {
    enabled: true,
    version: 1,
    globalMode: "STANDARD",
    enabledScenarios: launchScenarios,
    enabledIntents: [],
    intentPolicies: policies,
    fallbackPolicy: defaultIntentPolicies("SEND_BOOKING_LINK").UNKNOWN!,
    globalBehavior: {
      tone: "professional",
      maxClarificationAttempts: 2,
      followUpEnabled: false,
    },
    paymentPolicy: { textToPayEnabled: false, amountAuthority: "none" },
    serviceAreaPolicy: { mode: "clarify_zip", inAreaActions: [], outOfAreaActions: [] },
    existingCustomerPolicy: { treatDifferently: true, actions: [], notifyRecipientId: null },
    faqPolicy: { topics: ["HOURS", "SERVICES", "SERVICE_AREA", "FAQ"], fallback: "clarify" },
    collectCapabilities: [],
    answerCapabilities: [],
    actionCapabilities: launchCapabilities,
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

function intent(partial: Partial<StructuredLeadIntent>): StructuredLeadIntent {
  return {
    primary_intent: "UNKNOWN",
    secondary_intents: [],
    lead_type: "UNKNOWN",
    urgency: "NORMAL",
    service_category: null,
    reason_for_contact: null,
    location: { raw: null, resolved: null },
    requested_time: null,
    booking_requested: false,
    booking_disposition: "NONE",
    callback_requested: false,
    payment_intent: false,
    complaint: false,
    human_requested: false,
    human_required: false,
    needs_clarification: false,
    extracted_entities: {},
    semantic_missing_information: [],
    language: "en",
    confidence: 0.9,
    missing_required_fields: [],
    workflow_updates: [],
    stop_scope: null,
    ...partial,
  };
}

const bookingPolicy = simulateLeadRecoveryPolicy({
  config: baseConfig(),
  intent: intent({
    primary_intent: "BOOKING_REQUEST",
    booking_requested: true,
    booking_disposition: "REQUEST_BOOKING",
  }),
  collectedData: { APPOINTMENT_PREFERENCE: "this week" },
});
assert.ok(
  bookingPolicy.nextActions.some((a) => a.action === "SEND_BOOKING_LINK"),
  "booking uses SEND_BOOKING_LINK",
);
assert.ok(
  !bookingPolicy.nextActions.some((a) => a.action === "AI_BOOK"),
  "booking must not use AI_BOOK",
);
assert.ok(
  !bookingPolicy.nextActions.some((a) => a.action === "ANSWER_APPROVED_INFORMATION"),
  "booking must not use FAQ answer action",
);

assert.ok(!isActionPermitted("AI_BOOK", baseConfig()));
assert.ok(isActionPermitted("ANSWER_APPROVED_INFORMATION", baseConfig()));

const approvedFixture: MctbApprovedBusinessInformation = {
  business_name: "Acme HVAC",
  business_hours: "Mon-Fri 8 AM-5 PM",
  services: ["HVAC repair", "Furnace installation"],
  locations: [{ name: "Main office", address: "123 Main St" }],
  website: "https://acme.example",
  knowledge_facts: [
    { label: "Service area", summary: "We serve Fairfax and Arlington counties." },
  ],
  prompt_block: "Business hours: Mon-Fri 8 AM-5 PM\nServices: HVAC repair",
};

const hoursReply = resolveApprovedInformationReplyForTest({
  customerMessage: "What time do you close?",
  intent: "BUSINESS_HOURS",
  config: baseConfig(),
  approved: approvedFixture,
});
assert.equal(hoursReply.grounded, true);
assert.match(hoursReply.reply, /8 AM-5 PM/i);

const serviceReply = resolveApprovedInformationReplyForTest({
  customerMessage: "Do you do furnace work?",
  intent: "BUSINESS_FAQ",
  config: baseConfig(),
  approved: approvedFixture,
});
assert.equal(serviceReply.grounded, true);
assert.match(serviceReply.reply, /Furnace installation/i);

const unknownReply = resolveApprovedInformationReplyForTest({
  customerMessage: "Do you install swimming pools?",
  intent: "BUSINESS_FAQ",
  config: baseConfig(),
  approved: approvedFixture,
});
assert.equal(unknownReply.grounded, false);
assert.ok(!/yes|no|we install pools/i.test(unknownReply.reply));

const customerSms = fs.readFileSync(
  path.join(process.cwd(), "src/lib/agents/missed-call-text-back/customer-sms.ts"),
  "utf8",
);
assert.ok(isCarrierProtocolOptOutMessage("STOP"));
const stopIdx = customerSms.indexOf("isCarrierProtocolOptOutMessage");
const lrIdx = customerSms.indexOf("lead_recovery_not_enabled");
assert.ok(stopIdx > 0 && lrIdx > 0 && stopIdx < lrIdx);

const semantic = fs.readFileSync(
  path.join(process.cwd(), "src/lib/mctb/semantic-conversation-context.ts"),
  "utf8",
);
assert.ok(semantic.includes("approved_business_information"));
assert.ok(semantic.includes("loadMctbApprovedBusinessInformation"));
assert.ok(!semantic.includes("voice-v3"));
assert.ok(!semantic.includes("searchKnowledge"));

const offConfig = { ...baseConfig(), enabled: false };
assert.equal(offConfig.enabled, false);

console.log("test-mctb-launch-approved-faq: PASS");
