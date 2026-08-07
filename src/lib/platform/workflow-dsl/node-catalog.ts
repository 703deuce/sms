/**
 * Fixed node catalog for Workflow Architect — no super_magic_booking_node allowed.
 */
import type { WorkflowNodeType } from "./types";

export type NodeCatalogEntry = {
  type: WorkflowNodeType;
  version: number;
  category: "trigger" | "data" | "condition" | "scheduling" | "messaging" | "call" | "control";
  label: string;
  required_inputs: string[];
  optional_inputs?: string[];
  outputs: string[];
  side_effects: boolean;
  requires_failure_path: boolean;
  /** Maps to appointment-booking workflow-blocks.ts type when compiling legacy drafts. */
  legacy_block_type?: string;
};

export const WORKFLOW_NODE_CATALOG: NodeCatalogEntry[] = [
  // TRIGGERS
  { type: "incoming_call", version: 1, category: "trigger", label: "Incoming call", required_inputs: [], outputs: ["call"], side_effects: false, requires_failure_path: false, legacy_block_type: "inbound_call" },
  { type: "missed_call", version: 1, category: "trigger", label: "Missed call", required_inputs: [], outputs: ["call"], side_effects: false, requires_failure_path: false },
  { type: "sms_received", version: 1, category: "trigger", label: "SMS received", required_inputs: [], outputs: ["message"], side_effects: false, requires_failure_path: false },
  { type: "manual_start", version: 1, category: "trigger", label: "Manual start", required_inputs: [], outputs: [], side_effects: false, requires_failure_path: false },
  // DATA
  { type: "lookup_customer", version: 1, category: "data", label: "Lookup customer", required_inputs: ["phone"], outputs: ["customer"], side_effects: false, requires_failure_path: true, legacy_block_type: "lookup_customer" },
  { type: "collect_field", version: 1, category: "data", label: "Collect field", required_inputs: ["field_id"], outputs: ["value"], side_effects: false, requires_failure_path: false, legacy_block_type: "collect_field" },
  { type: "record_field", version: 1, category: "data", label: "Record field", required_inputs: ["field_id", "value"], outputs: [], side_effects: true, requires_failure_path: false },
  { type: "set_variable", version: 1, category: "data", label: "Set variable", required_inputs: ["name", "value"], outputs: [], side_effects: false, requires_failure_path: false },
  // CONDITIONS
  { type: "if", version: 1, category: "condition", label: "If", required_inputs: ["expression"], outputs: ["true", "false"], side_effects: false, requires_failure_path: false, legacy_block_type: "branch" },
  { type: "business_hours", version: 1, category: "condition", label: "Business hours", required_inputs: ["timezone"], outputs: ["open", "closed"], side_effects: false, requires_failure_path: false },
  { type: "field_equals", version: 1, category: "condition", label: "Field equals", required_inputs: ["field_id", "value"], outputs: ["match", "no_match"], side_effects: false, requires_failure_path: false },
  { type: "customer_exists", version: 1, category: "condition", label: "Customer exists", required_inputs: [], outputs: ["yes", "no"], side_effects: false, requires_failure_path: false },
  { type: "integration_available", version: 1, category: "condition", label: "Integration available", required_inputs: ["provider"], outputs: ["available", "unavailable"], side_effects: false, requires_failure_path: true },
  // SCHEDULING
  { type: "check_availability", version: 1, category: "scheduling", label: "Check availability", required_inputs: ["service_id"], outputs: ["slots"], side_effects: false, requires_failure_path: true, legacy_block_type: "check_availability" },
  { type: "hold_slot", version: 1, category: "scheduling", label: "Hold slot", required_inputs: ["start_time"], outputs: ["hold_id"], side_effects: true, requires_failure_path: true, legacy_block_type: "hold_appointment_slot" },
  { type: "confirm_booking", version: 1, category: "scheduling", label: "Confirm booking", required_inputs: ["start_time", "service_id"], outputs: ["appointment_id"], side_effects: true, requires_failure_path: true, legacy_block_type: "create_appointment" },
  { type: "find_appointment", version: 1, category: "scheduling", label: "Find appointment", required_inputs: [], outputs: ["appointments"], side_effects: false, requires_failure_path: true },
  { type: "reschedule", version: 1, category: "scheduling", label: "Reschedule", required_inputs: ["appointment_id", "new_start_time"], outputs: ["appointment_id"], side_effects: true, requires_failure_path: true },
  { type: "cancel", version: 1, category: "scheduling", label: "Cancel", required_inputs: ["appointment_id"], outputs: [], side_effects: true, requires_failure_path: true },
  // MESSAGING
  { type: "send_sms", version: 1, category: "messaging", label: "Send SMS", required_inputs: ["to", "body"], outputs: ["message_id"], side_effects: true, requires_failure_path: true },
  { type: "send_email", version: 1, category: "messaging", label: "Send email", required_inputs: ["to", "subject", "body"], outputs: ["message_id"], side_effects: true, requires_failure_path: true },
  // CALL
  { type: "transfer", version: 1, category: "call", label: "Transfer", required_inputs: ["destination"], outputs: [], side_effects: true, requires_failure_path: true, legacy_block_type: "transfer_call" },
  { type: "escalate", version: 1, category: "call", label: "Escalate", required_inputs: ["destination"], outputs: [], side_effects: true, requires_failure_path: true },
  { type: "take_message", version: 1, category: "call", label: "Take message", required_inputs: [], outputs: ["message"], side_effects: true, requires_failure_path: false, legacy_block_type: "take_message" },
  { type: "end_call", version: 1, category: "call", label: "End call", required_inputs: [], outputs: [], side_effects: true, requires_failure_path: false, legacy_block_type: "end_call" },
  // CONTROL
  { type: "wait", version: 1, category: "control", label: "Wait", required_inputs: ["delay_seconds"], outputs: [], side_effects: false, requires_failure_path: false },
  { type: "branch", version: 1, category: "control", label: "Branch", required_inputs: ["branches"], outputs: [], side_effects: false, requires_failure_path: false, legacy_block_type: "branch" },
  { type: "retry", version: 1, category: "control", label: "Retry", required_inputs: ["max_attempts", "next"], outputs: [], side_effects: false, requires_failure_path: false },
  { type: "fallback", version: 1, category: "control", label: "Fallback", required_inputs: ["next"], outputs: [], side_effects: false, requires_failure_path: false },
  { type: "end", version: 1, category: "control", label: "End", required_inputs: [], outputs: [], side_effects: false, requires_failure_path: false },
];

const CATALOG_BY_TYPE = new Map(WORKFLOW_NODE_CATALOG.map((n) => [n.type, n]));

export function getNodeCatalogEntry(type: string): NodeCatalogEntry | null {
  return CATALOG_BY_TYPE.get(type as WorkflowNodeType) || null;
}

export function isRegisteredNodeType(type: string): boolean {
  return CATALOG_BY_TYPE.has(type as WorkflowNodeType);
}

export function sideEffectingNodeTypes(): WorkflowNodeType[] {
  return WORKFLOW_NODE_CATALOG.filter((n) => n.side_effects).map((n) => n.type);
}
