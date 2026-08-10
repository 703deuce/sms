import type { WorkflowDefinition } from "../schema";
import { assertValidWorkflowDefinition } from "../validator";

/** Home-service dispatcher — master receptionist E2E workflow (configuration-driven). */
export const HOME_SERVICE_DISPATCHER_WORKFLOW_V1: WorkflowDefinition = {
  schemaVersion: 1,
  id: "home_service_dispatcher",
  version: 1,
  name: "Home service dispatcher",
  description:
    "Dynamic intake, qualification, eligibility, multi-resource scheduling, booking, transfer, and modify flows.",
  entryNodeId: "lookup_customer",
  globalPolicies: {
    alwaysAllow: ["call.transfer", "call.end", "knowledge.answer"],
  },
  metadata: {
    serviceAreas: {
      cities: ["Fredericksburg", "Stafford", "Spotsylvania"],
      zipCodes: ["22401", "22405", "22407", "22554"],
      zones: [
        { id: "zone_a", name: "North County", cities: ["Stafford"] },
        { id: "zone_b", name: "Fredericksburg", cities: ["Fredericksburg", "Spotsylvania"] },
      ],
    },
    qualificationRules: [
      {
        id: "gas_emergency",
        when: { classification: "safety", equals: "gas_smell" },
        then: {
          action: "transfer",
          destination: "on_call",
          message: "This sounds like a safety emergency. I'm connecting you with our on-call technician.",
        },
      },
      {
        id: "urgent_priority",
        when: { classification: "urgency", equals: "urgent" },
        then: { action: "priority_schedule", message: "I'll prioritize the earliest available technician." },
      },
    ],
    transferDestination: process.env.VOICE_TRANSFER_FALLBACK_E164 || "+15555550100",
    pricing: {
      serviceCallFee: "$89",
      serviceCallScript:
        "Our standard service call fee is $89, which covers the diagnostic visit. Additional repair costs are quoted on site.",
      unknownScript:
        "Pricing depends on the specific job. The technician will provide an exact quote after diagnosing the issue.",
    },
    businessHours: "Monday through Friday, 8 AM to 6 PM",
  },
  nodes: [
    {
      id: "lookup_customer",
      type: "action",
      capability: "customer.lookup",
      instructions:
        "Use lookup_customer when appropriate. Do not assume the ANI match is the speaker.",
      requiresUserInput: false,
      transitions: [{ to: "detect_intent", when: "default" }],
    },
    {
      id: "detect_intent",
      type: "action",
      capability: "intent.detect",
      instructions:
        "Call detect_caller_intent once you understand why the caller is calling. Route book vs reschedule vs cancel vs emergency.",
      requiresUserInput: false,
      transitions: [
        { to: "emergency_handoff", when: "emergency" },
        { to: "reschedule_lookup", when: "reschedule_intent" },
        { to: "cancel_lookup", when: "cancel_intent" },
        { to: "collect_fields", when: "book_intent" },
        { to: "collect_fields", when: "default" },
      ],
    },
    {
      id: "collect_fields",
      type: "collect_fields",
      description: "Dynamic intake — fields from tenant manifest",
      instructions: "Collect required caller details one at a time.",
      fields: [],
      metadata: { manifestDriven: true },
      requiresUserInput: true,
      transitions: [{ to: "classify", when: "fields_complete" }],
    },
    {
      id: "classify",
      type: "condition",
      capability: "rules.classify",
      instructions: "Call classify_intent after safety-relevant details are known.",
      requiresUserInput: false,
      transitions: [
        { to: "emergency_handoff", when: "emergency" },
        { to: "validate_eligibility", when: "normal" },
      ],
    },
    {
      id: "emergency_handoff",
      type: "handoff",
      capability: "call.transfer",
      instructions: "Transfer immediately for safety emergencies.",
      requiresUserInput: false,
      transitions: [{ to: "transfer_fallback", when: "default" }],
    },
    {
      id: "transfer_fallback",
      type: "action",
      capability: "message.save",
      instructions: "If transfer fails, take a message and notify the business.",
      transitions: [{ to: "complete", when: "default" }],
    },
    {
      id: "validate_eligibility",
      type: "action",
      capability: "eligibility.validate",
      instructions: "Call validate_eligibility once service address is known.",
      requiresUserInput: false,
      transitions: [{ to: "check_availability", when: "default" }],
    },
    {
      id: "check_availability",
      type: "action",
      capability: "calendar.check_availability",
      instructions: "Check real availability. Never invent times.",
      requiresUserInput: false,
      transitions: [{ to: "select_slot", when: "default" }],
    },
    {
      id: "select_slot",
      type: "choice",
      capability: "calendar.select_slot",
      instructions: "Offer two or three times naturally, then listen for their choice.",
      requiresUserInput: true,
      transitions: [{ to: "confirm_booking", when: "default" }],
    },
    {
      id: "confirm_booking",
      type: "confirmation",
      capability: "calendar.create_booking",
      instructions: "Read back the held time and get an explicit yes before confirming.",
      requiresExplicitConfirmation: true,
      requiresUserInput: true,
      transitions: [{ to: "complete", when: "confirmation_received" }],
    },
    {
      id: "reschedule_lookup",
      type: "action",
      capability: "calendar.find_appointments",
      instructions: "Find the caller's existing appointment before rescheduling.",
      transitions: [{ to: "check_availability", when: "default" }],
    },
    {
      id: "cancel_lookup",
      type: "action",
      capability: "calendar.find_appointments",
      instructions: "Find the appointment before cancelling.",
      transitions: [{ to: "cancel_confirm", when: "default" }],
    },
    {
      id: "cancel_confirm",
      type: "confirmation",
      capability: "calendar.cancel",
      instructions: "Confirm cancellation explicitly before calling cancel_appointment.",
      requiresExplicitConfirmation: true,
      requiresUserInput: true,
      transitions: [{ to: "complete", when: "confirmation_received" }],
    },
    {
      id: "complete",
      type: "completion",
      instructions: "Wrap up politely. Use end_call when finished.",
      transitions: [],
    },
  ],
};

assertValidWorkflowDefinition(HOME_SERVICE_DISPATCHER_WORKFLOW_V1);
