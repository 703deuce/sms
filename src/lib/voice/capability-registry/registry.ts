import type { CapabilityDefinition } from "./types";

/**
 * Permanent catalog of capabilities Transovo can execute.
 * Workflows reference capability IDs — never implementation code.
 */
export const CAPABILITY_REGISTRY: Record<string, CapabilityDefinition> = {
  "data.capture": {
    id: "data.capture",
    description: "Record caller-provided field values for the active workflow.",
    toolNames: ["record_current_field", "record_fields"],
    sideEffectLevel: "write",
    confirmationPolicy: "never",
    allowedInNodeTypes: ["collect_fields", "conversation"],
  },
  "data.lookup": {
    id: "data.lookup",
    description: "Return required fields and collection status for the workflow.",
    toolNames: ["get_booking_requirements"],
    sideEffectLevel: "read",
    confirmationPolicy: "never",
    allowedInNodeTypes: ["collect_fields", "conversation"],
  },
  "calendar.check_availability": {
    id: "calendar.check_availability",
    description: "Check connected calendar for real appointment openings.",
    toolNames: ["check_availability"],
    sideEffectLevel: "read",
    confirmationPolicy: "never",
    allowedInNodeTypes: ["action"],
  },
  "calendar.select_slot": {
    id: "calendar.select_slot",
    description: "Select a slot from previously returned availability.",
    toolNames: ["select_slot"],
    sideEffectLevel: "write",
    confirmationPolicy: "never",
    allowedInNodeTypes: ["choice", "action"],
  },
  "calendar.create_booking": {
    id: "calendar.create_booking",
    description: "Create the appointment after explicit caller confirmation.",
    toolNames: ["confirm_booking"],
    sideEffectLevel: "write",
    confirmationPolicy: "required_before_execute",
    allowedInNodeTypes: ["confirmation", "action"],
  },
  "message.save": {
    id: "message.save",
    description: "Persist a caller message for staff follow-up.",
    toolNames: ["take_message", "save_message"],
    sideEffectLevel: "write",
    confirmationPolicy: "never",
    allowedInNodeTypes: ["action"],
  },
  "message.notify_owner": {
    id: "message.notify_owner",
    description: "Notify the business owner about a saved message.",
    toolNames: ["notify_owner"],
    sideEffectLevel: "write",
    confirmationPolicy: "never",
    allowedInNodeTypes: ["action"],
  },
  "call.transfer": {
    id: "call.transfer",
    description: "Transfer the caller to a human or configured destination.",
    toolNames: ["request_human", "transfer_call"],
    sideEffectLevel: "transfer",
    confirmationPolicy: "optional",
    allowedInNodeTypes: ["handoff", "action", "condition"],
  },
  "call.end": {
    id: "call.end",
    description: "End the call politely when the workflow is complete.",
    toolNames: ["end_call"],
    sideEffectLevel: "end",
    confirmationPolicy: "never",
    allowedInNodeTypes: ["completion", "conversation", "collect_fields", "action", "choice", "confirmation", "handoff"],
  },
};

export function getCapability(id: string): CapabilityDefinition | undefined {
  return CAPABILITY_REGISTRY[id];
}

export function listCapabilityIds(): string[] {
  return Object.keys(CAPABILITY_REGISTRY);
}

export function toolNamesForCapabilities(capabilityIds: Iterable<string>): string[] {
  const names = new Set<string>();
  for (const id of capabilityIds) {
    const cap = CAPABILITY_REGISTRY[id];
    if (!cap) continue;
    for (const name of cap.toolNames) names.add(name);
  }
  return [...names];
}

export function capabilityForToolName(toolName: string): CapabilityDefinition | undefined {
  return Object.values(CAPABILITY_REGISTRY).find((cap) =>
    cap.toolNames.includes(toolName),
  );
}
