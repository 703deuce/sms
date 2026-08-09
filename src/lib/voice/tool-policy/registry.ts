import { CAPABILITY_REGISTRY } from "@/lib/voice/capability-registry/registry";

export type ToolPolicyEntry = {
  id: string;
  capability: string;
  sideEffectLevel: "read" | "write" | "transfer" | "end";
  confirmationRequirement: "never" | "optional" | "required_before_execute";
  idempotencyPolicy: "none" | "per_call" | "per_operation_id";
  allowedTaskTypes: string[];
  preconditions?: string[];
};

const TASK_TYPES = [
  "DiscoverIntentTask",
  "CollectRequiredFieldsTask",
  "LookupCustomerTask",
  "QualificationTask",
  "ValidateEligibilityTask",
  "ResolveServiceResourceTask",
  "CheckAvailabilityTask",
  "SelectResourceTask",
  "ConfirmActionTask",
  "TransferTask",
  "TakeMessageTask",
  "RescheduleTask",
  "CancelTask",
  "CompleteCallTask",
] as const;

export type GenericTaskType = (typeof TASK_TYPES)[number];

/** Tool policy derived from capability registry + receptionist extensions. */
export const TOOL_POLICY: Record<string, ToolPolicyEntry> = {};

function registerTool(input: Omit<ToolPolicyEntry, "capability"> & { capability: string }) {
  TOOL_POLICY[input.id] = input;
}

for (const cap of Object.values(CAPABILITY_REGISTRY)) {
  for (const toolName of cap.toolNames) {
    registerTool({
      id: toolName,
      capability: cap.id,
      sideEffectLevel: cap.sideEffectLevel,
      confirmationRequirement:
        cap.confirmationPolicy === "required_before_execute"
          ? "required_before_execute"
          : cap.confirmationPolicy === "optional"
            ? "optional"
            : "never",
      idempotencyPolicy:
        cap.sideEffectLevel === "write" || cap.sideEffectLevel === "transfer"
          ? "per_operation_id"
          : "none",
      allowedTaskTypes: [...TASK_TYPES],
    });
  }
}

// Receptionist-specific tools
registerTool({
  id: "lookup_customer",
  capability: "customer.lookup",
  sideEffectLevel: "read",
  confirmationRequirement: "never",
  idempotencyPolicy: "none",
  allowedTaskTypes: ["LookupCustomerTask", "DiscoverIntentTask", "CollectRequiredFieldsTask"],
});

registerTool({
  id: "validate_eligibility",
  capability: "eligibility.validate",
  sideEffectLevel: "read",
  confirmationRequirement: "never",
  idempotencyPolicy: "none",
  allowedTaskTypes: ["ValidateEligibilityTask", "CollectRequiredFieldsTask"],
});

registerTool({
  id: "classify_intent",
  capability: "rules.classify",
  sideEffectLevel: "read",
  confirmationRequirement: "never",
  idempotencyPolicy: "none",
  allowedTaskTypes: ["QualificationTask", "DiscoverIntentTask"],
});

registerTool({
  id: "find_appointments",
  capability: "calendar.find_appointments",
  sideEffectLevel: "read",
  confirmationRequirement: "never",
  idempotencyPolicy: "none",
  allowedTaskTypes: ["RescheduleTask", "CancelTask"],
});

registerTool({
  id: "reschedule_appointment",
  capability: "calendar.reschedule",
  sideEffectLevel: "write",
  confirmationRequirement: "required_before_execute",
  idempotencyPolicy: "per_operation_id",
  allowedTaskTypes: ["RescheduleTask"],
  preconditions: ["appointment_selected", "replacement_slot_held"],
});

registerTool({
  id: "cancel_appointment",
  capability: "calendar.cancel",
  sideEffectLevel: "write",
  confirmationRequirement: "required_before_execute",
  idempotencyPolicy: "per_operation_id",
  allowedTaskTypes: ["CancelTask"],
  preconditions: ["appointment_selected"],
});

export function getToolPolicy(toolName: string): ToolPolicyEntry | undefined {
  return TOOL_POLICY[toolName];
}

export function isToolAllowedForTask(toolName: string, taskType: string): boolean {
  const policy = getToolPolicy(toolName);
  if (!policy) return false;
  return policy.allowedTaskTypes.includes(taskType);
}

export { TASK_TYPES };
