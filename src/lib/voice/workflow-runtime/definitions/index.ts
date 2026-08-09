import type { WorkflowDefinition } from "../schema";
import { assertValidWorkflowDefinition } from "../validator";

/** Appointment booking workflow — data, not code. */
export const APPOINTMENT_BOOKING_WORKFLOW_V1: WorkflowDefinition = {
  schemaVersion: 1,
  id: "appointment_booking",
  version: 1,
  name: "Appointment booking",
  description: "Collect service details, check calendar, select slot, confirm booking.",
  entryNodeId: "collect_fields",
  globalPolicies: {
    alwaysAllow: ["call.transfer", "call.end"],
  },
  nodes: [
    {
      id: "collect_fields",
      type: "collect_fields",
      description: "Collect required booking information",
      instructions:
        "Collect the active field from the caller. When they provide it, call record_current_field. Ask one field at a time in order: service or problem details first, then name and email. Do not call check_availability until every required field is collected.",
      fields: [], // Hydrated at runtime from agent field manifest (manifestDriven)
      metadata: { manifestDriven: true },
      requiresUserInput: true,
      transitions: [{ to: "check_availability", when: "fields_complete" }],
    },
    {
      id: "check_availability",
      type: "action",
      capability: "calendar.check_availability",
      instructions:
        "Call check_availability before offering any appointment times. Never invent times.",
      requiresUserInput: false,
      transitions: [{ to: "select_slot", when: "default" }],
    },
    {
      id: "select_slot",
      type: "choice",
      capability: "calendar.select_slot",
      instructions:
        "Offer returned slots conversationally. When the caller chooses, call select_slot.",
      requiresUserInput: true,
      transitions: [{ to: "confirm_booking", when: "default" }],
    },
    {
      id: "confirm_booking",
      type: "confirmation",
      capability: "calendar.create_booking",
      instructions:
        "Ask for explicit confirmation. After the caller confirms, call confirm_booking({ confirmed: true }).",
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

/** Message-taking workflow — proves Amber can swap behavior without deploy. */
export const MESSAGE_TAKING_WORKFLOW_V1: WorkflowDefinition = {
  schemaVersion: 1,
  id: "message_taking",
  version: 1,
  name: "Message taking",
  description: "Collect caller message and save for staff follow-up.",
  entryNodeId: "collect_fields",
  globalPolicies: {
    alwaysAllow: ["call.transfer", "call.end"],
  },
  nodes: [
    {
      id: "collect_fields",
      type: "collect_fields",
      description: "Collect message details",
      instructions:
        "Collect the active field. Call record_current_field when the caller provides it.",
      fields: [
        {
          id: "caller_name",
          type: "text",
          required: true,
          label: "Name",
          instruction: "May I have your name?",
        },
        {
          id: "callback_number",
          type: "phone",
          required: true,
          label: "Phone number",
          instruction: "What is the best number to reach you?",
        },
        {
          id: "message",
          type: "long_text",
          required: true,
          label: "Message",
          instruction: "What message would you like me to pass along?",
        },
      ],
      requiresUserInput: true,
      transitions: [{ to: "save_message", when: "fields_complete" }],
    },
    {
      id: "save_message",
      type: "action",
      capability: "message.save",
      instructions: "Save the caller's message using take_message.",
      requiresUserInput: false,
      transitions: [{ to: "complete", when: "default" }],
    },
    {
      id: "complete",
      type: "completion",
      instructions: "Thank the caller and end the call.",
      transitions: [],
    },
  ],
};

/** Message-taking v2 — adds address + preferred callback time (config-only change). */
export const MESSAGE_TAKING_WORKFLOW_V2: WorkflowDefinition = {
  ...MESSAGE_TAKING_WORKFLOW_V1,
  version: 2,
  name: "Message taking (extended)",
  nodes: [
    {
      ...MESSAGE_TAKING_WORKFLOW_V1.nodes[0],
      fields: [
        ...(MESSAGE_TAKING_WORKFLOW_V1.nodes[0].fields || []),
        {
          id: "service_address",
          type: "address",
          required: true,
          label: "Address",
          instruction: "What is the service address?",
        },
        {
          id: "preferred_time_of_day",
          type: "text",
          required: true,
          label: "Preferred callback time",
          instruction: "What time of day works best for a callback?",
        },
      ],
    },
    MESSAGE_TAKING_WORKFLOW_V1.nodes[1],
    MESSAGE_TAKING_WORKFLOW_V1.nodes[2],
  ],
};

assertValidWorkflowDefinition(APPOINTMENT_BOOKING_WORKFLOW_V1);
assertValidWorkflowDefinition(MESSAGE_TAKING_WORKFLOW_V1);
assertValidWorkflowDefinition(MESSAGE_TAKING_WORKFLOW_V2);
