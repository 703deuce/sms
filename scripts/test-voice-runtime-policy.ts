#!/usr/bin/env tsx
/**
 * Voice runtime: wizard→LR policy bridge, RAG gate, capability resolver, tool results.
 * npx tsx scripts/test-voice-runtime-policy.ts
 */
import assert from "node:assert/strict";
import { applyWizardPreset, createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import {
  deriveLeadRecoveryPolicyFromWizard,
  evaluateVoiceIntentPolicy,
} from "../src/lib/voice/runtime/wizard-policy-bridge";
import { evaluateRagGate } from "../src/lib/voice/runtime/rag-gate";
import {
  emptyVoiceCallState,
  resolveVoiceCapabilities,
  mapWorkflowStateFromIntent,
} from "../src/lib/voice/runtime";
import { normalizeVoiceToolResult } from "../src/lib/voice/runtime/tool-result";
import { compileVoiceAgentPrompt } from "../src/lib/voice/prompt/compile-voice-agent-prompt";

function main() {
  const wizard = createDefaultWizardState();
  wizard.businessName = "ABC Plumbing";
  wizard.capabilities = ["answer_questions", "take_messages", "book_appointments", "transfer_calls"];
  wizard.transferDestinationPhone = "+17035551234";
  wizard.calendarConnected = false;
  wizard.appointmentTypes = [
    {
      id: "1",
      name: "Service Call",
      durationMin: 60,
      calendar: "default",
      status: "ready",
      requiredFields: [],
      bookingPermission: "send_booking_link",
      enabled: true,
    },
  ];

  const policy = deriveLeadRecoveryPolicyFromWizard(wizard);
  assert.ok(policy.intentPolicies.BOOKING_REQUEST?.actions?.includes("SEND_BOOKING_LINK"));
  assert.ok(policy.intentPolicies.EMERGENCY_OR_URGENT?.actions?.includes("SEND_OWNER_SMS"));
  assert.ok(policy.actionCapabilities.includes("ESCALATE_HUMAN"));

  const bookingEval = evaluateVoiceIntentPolicy({
    config: policy,
    intent: {
      primary_intent: "BOOKING_REQUEST",
      secondary_intents: [],
      lead_type: "NEW",
      urgency: "NORMAL",
      service_category: "plumbing",
      reason_for_contact: "need appointment",
      location: { raw: null, resolved: null },
      requested_time: null,
      booking_requested: true,
      callback_requested: false,
      payment_intent: false,
      complaint: false,
      human_required: false,
      language: "en",
      confidence: 0.9,
      missing_required_fields: [],
    },
  });
  assert.ok(
    bookingEval.permittedActions.includes("SEND_BOOKING_LINK") ||
      bookingEval.nextActions.some((a) => a.action === "SEND_BOOKING_LINK"),
  );

  const hoursGate = evaluateRagGate("What time do you close?");
  assert.equal(hoursGate.route, "prompt_context");

  const addressGate = evaluateRagGate("What is your address?");
  assert.equal(addressGate.route, "prompt_context");

  const modelGate = evaluateRagGate("Do you carry Toto Drake model CST776?");
  assert.equal(modelGate.route, "rag_allowed");

  const availGate = evaluateRagGate("Do you have Tuesday at 3pm available?");
  assert.equal(availGate.route, "runtime_authoritative");

  const callState = emptyVoiceCallState({
    callId: "test-call",
    workspaceId: "ws",
    agentId: "agent",
  });
  callState.currentState = mapWorkflowStateFromIntent("BOOKING_REQUEST");
  const caps = resolveVoiceCapabilities({
    callState,
    wizard,
    policy: bookingEval,
  });
  assert.ok(caps.allowedTools.includes("send_resource"));
  assert.ok(caps.capabilities.includes("send_booking_link"));

  const afterHours = applyWizardPreset(createDefaultWizardState(), "after_hours");
  afterHours.calendarConnected = true;
  afterHours.appointmentTypes = wizard.appointmentTypes;
  const ahPolicy = deriveLeadRecoveryPolicyFromWizard(afterHours);
  assert.ok(
    !ahPolicy.intentPolicies.BOOKING_REQUEST?.actions?.includes("AI_BOOK"),
    "after-hours must never AI_BOOK even with calendar connected",
  );
  assert.ok(ahPolicy.intentPolicies.BOOKING_REQUEST?.actions?.includes("SEND_BOOKING_LINK"));

  const denied = normalizeVoiceToolResult({
    action: "send_resource",
    raw: { ok: false, error_code: "TOOL_NOT_ALLOWED", speak: "Not allowed." },
  });
  assert.equal(denied.status, "denied");
  assert.equal(denied.fallback, "capture_message");

  const compiled = compileVoiceAgentPrompt({ wizard, profile: "after_hours" });
  assert.ok(compiled.metadata.policyVersion?.startsWith("lr-wizard"));

  console.log("test-voice-runtime-policy: PASS");
  console.log(`  booking tools: ${caps.allowedTools.join(", ")}`);
  console.log(`  rag hours gate: ${hoursGate.route}`);
  console.log(`  policy version: ${compiled.metadata.policyVersion}`);
}

main();
